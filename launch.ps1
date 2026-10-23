# First-run setup and app launcher for Windows. No administrator access needed.
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$data = Join-Path $env:USERPROFILE '.agent-office'
New-Item -ItemType Directory -Force -Path $data | Out-Null
$port = 3300
$base = "http://127.0.0.1:$port/"

function Test-Server {
    try {
        $response = Invoke-WebRequest -Uri $base -UseBasicParsing -TimeoutSec 2
    } catch { return $false }
    if ($response.Content -notmatch '<div id="scene">') {
        throw 'Port 3300 is used by another application.'
    }
    return $true
}

$node = Get-Command node -ErrorAction SilentlyContinue
$usable = $false
if ($node) {
    $version = [version]((& $node.Source --version).Trim().TrimStart('v'))
    $usable = $version -ge [version]'22.12.0'
}
if (-not $usable) {
    $version = '22.23.4'
    $arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
    $name = "node-v$version-win-$arch"
    $runtime = Join-Path $data "runtime\$name"
    if (-not (Test-Path "$runtime\node.exe")) {
        Write-Host "Downloading Node.js $version (user-local, no administrator access)..."
        $zip = Join-Path $data "$name.zip"
        Invoke-WebRequest "https://nodejs.org/dist/v$version/$name.zip" -OutFile $zip -UseBasicParsing
        $expected = if ($arch -eq 'arm64') {
            'a8b8cd79cbbb3062435f449591d98dd63730bbbf30ce2d7cc3a6376c236cb111'
        } else {
            'cbc74b5e0982c9dbb41525fd8fb5dcd32fbee237863f7829072f4639a1ce5f20'
        }
        if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
            throw 'Node.js checksum verification failed.'
        }
        Expand-Archive $zip -DestinationPath (Join-Path $data 'runtime') -Force
    }
    $nodePath = Join-Path $runtime 'node.exe'
} else { $nodePath = $node.Source }
$env:PATH = "$(Split-Path $nodePath);$env:PATH"
$npm = Join-Path (Split-Path $nodePath) 'npm.cmd'
if (-not (Test-Path $npm)) { throw 'npm is missing. Install Node.js with npm, then retry.' }

Push-Location $root
try {
    $lockHash = (Get-FileHash 'package-lock.json' -Algorithm SHA256).Hash
    $stamp = Join-Path $root 'node_modules\.agent-office-windows-install'
    $key = "$lockHash|$(& $nodePath --version)"
    if (-not (Test-Path $stamp) -or (Get-Content $stamp -Raw) -ne $key) {
        & $npm ci
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
        [IO.File]::WriteAllText($stamp, $key)
    }
    & $npm run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed.' }
} finally { Pop-Location }

if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
    Write-Warning 'Install Claude Code and sign in before creating agents. The office UI can still open.'
}
if (-not (Test-Server)) {
    $server = Start-Process -FilePath $nodePath -ArgumentList "`"$root\server\index.mjs`"", '--port', $port `
        -WorkingDirectory $root -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $data 'server.log') -RedirectStandardError (Join-Path $data 'server-error.log')
    for ($i = 0; $i -lt 100 -and -not (Test-Server); $i++) {
        if ($server.HasExited) { throw "Server failed to start. See $data\server-error.log" }
        Start-Sleep -Milliseconds 200
    }
    if (-not (Test-Server)) { throw "Server startup timed out. See $data\server-error.log" }
}
$url = (Get-Content (Join-Path $data 'url.txt') -Raw).Trim()
$uri = [uri]$url
if ($uri.Scheme -ne 'http' -or $uri.Host -ne '127.0.0.1' -or $uri.Port -ne $port) {
    throw 'Invalid local launch URL.'
}

# Use a private browser profile to keep app windows separate from normal tabs.
$browsers = @(
    "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)
$browser = $browsers | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($browser) {
    $profile = Join-Path $data 'browser-profile'
    Start-Process $browser -ArgumentList "--app=$url", "--user-data-dir=`"$profile`"", '--no-first-run', '--window-size=1500,900'
} else { Start-Process $url }

$shell = New-Object -ComObject WScript.Shell
foreach ($folder in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {
    if ($folder) {
        $shortcut = $shell.CreateShortcut((Join-Path $folder 'Agent Office.lnk'))
        $shortcut.TargetPath = Join-Path $root 'launch.cmd'
        $shortcut.WorkingDirectory = $root
        $shortcut.Save()
    }
}
