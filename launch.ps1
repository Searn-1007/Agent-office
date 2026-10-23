# Agent Office launcher: starts the server (hidden) if needed, then opens the
# office in its own app window.
$port = 3300
$base = "http://127.0.0.1:$port/"
$root = $PSScriptRoot

function Test-Server {
    try { Invoke-WebRequest -Uri $base -UseBasicParsing -TimeoutSec 2 | Out-Null; return $true } catch { return $false }
}

if (-not (Test-Server)) {
    Start-Process -FilePath "node" -ArgumentList "`"$root\server\index.mjs`"", "--port", $port `
        -WorkingDirectory $root -WindowStyle Hidden
    for ($i = 0; $i -lt 40 -and -not (Test-Server); $i++) { Start-Sleep -Milliseconds 250 }
}

$url = (Get-Content "$env:USERPROFILE\.agent-office\url.txt" -Raw).Trim()
$edge = "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe"
# Own browser process (separate profile) so the flags apply even while normal
# Edge is open: render on the discrete GPU of an Optimus laptop, not the iGPU.
$profileDir = "$env:LOCALAPPDATA\AgentOffice\edge-profile"
Start-Process -FilePath $edge -ArgumentList "--app=$url", "--window-size=1500,900", `
    "--user-data-dir=`"$profileDir`"", "--force_high_performance_gpu", "--no-first-run"
