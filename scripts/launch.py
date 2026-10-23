#!/usr/bin/env python3
"""Linux first-run setup and desktop launcher; uses only the Python standard library."""
import argparse
import fcntl
import hashlib
import os
from pathlib import Path
import platform
import shutil
import subprocess
import tarfile
import tempfile
import time
import urllib.error
import urllib.request
import urllib.parse

ROOT = Path(__file__).resolve().parent.parent
DATA = Path.home() / '.agent-office'
NODE_VERSION = '22.23.4'
NODE_HASHES = {
    'x86_64': ('x64', '1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce'),
    'aarch64': ('arm64', '6287aa46b6c375d816e63ae66d024fbbfd70404825aabdfdf898a970871d2f4b'),
}
BASE = 'http://127.0.0.1:3300/'


def node_runtime():
    candidates = [shutil.which('node'), str(Path.home() / '.local/bin/node')]
    for candidate in candidates:
        if not candidate or not Path(candidate).is_file():
            continue
        result = subprocess.run([candidate, '--version'], capture_output=True, text=True)
        try:
            parts = result.stdout.strip().lstrip('v').split('.')
            major, minor = int(parts[0]), int(parts[1])
            if result.returncode == 0 and (major > 22 or (major == 22 and minor >= 12)):
                return Path(candidate).resolve()
        except (ValueError, IndexError):
            pass
    if platform.system() != 'Linux' or platform.machine() not in NODE_HASHES:
        raise RuntimeError('Please install Node.js 22+ with npm, then run again.')
    arch, expected = NODE_HASHES[platform.machine()]
    name = f'node-v{NODE_VERSION}-linux-{arch}'
    target = DATA / 'runtime' / name
    if (target / 'bin/node').is_file():
        return target / 'bin/node'
    print(f'Downloading Node.js {NODE_VERSION} (user-local, no sudo)...', flush=True)
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=target.parent) as temp:
        archive = Path(temp) / 'node.tar.xz'
        urllib.request.urlretrieve(f'https://nodejs.org/dist/v{NODE_VERSION}/{name}.tar.xz', archive)
        if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
            raise RuntimeError('Node.js checksum verification failed.')
        with tarfile.open(archive) as tar:
            # The archive is verified against a pinned official checksum above.
            if hasattr(tarfile, 'data_filter'):
                tar.extractall(temp, filter='data')
            else:
                tar.extractall(temp)
        Path(temp, name).rename(target)
    return target / 'bin/node'


def fingerprint(paths):
    digest = hashlib.sha256()
    for path in sorted(paths):
        digest.update(str(path.relative_to(ROOT)).encode())
        digest.update(path.read_bytes())
    return digest.hexdigest()


def prepare(node, env):
    npm = node.parent / 'npm'
    if not npm.is_file():
        raise RuntimeError('npm is missing beside Node.js. Install Node.js with npm and retry.')
    version = subprocess.check_output([str(node), '--version'], text=True).strip()
    dependency_key = fingerprint([ROOT / 'package.json', ROOT / 'package-lock.json']) + version
    stamp = ROOT / 'node_modules/.agent-office-install'
    if not stamp.is_file() or stamp.read_text() != dependency_key:
        print('Installing project dependencies...', flush=True)
        subprocess.run([str(npm), 'ci'], cwd=ROOT, env=env, check=True)
        stamp.write_text(dependency_key)
    source = [ROOT / 'package.json', ROOT / 'package-lock.json']
    source += [p for p in (ROOT / 'web').rglob('*') if p.is_file() and 'dist' not in p.relative_to(ROOT / 'web').parts]
    build_key = fingerprint(source)
    build_stamp = ROOT / 'web/dist/.agent-office-build'
    if not (ROOT / 'web/dist/index.html').is_file() or not build_stamp.is_file() or build_stamp.read_text() != build_key:
        print('Building Agent Office...', flush=True)
        subprocess.run([str(npm), 'run', 'build'], cwd=ROOT, env=env, check=True)
        build_stamp.write_text(build_key)


def server_running():
    try:
        with urllib.request.urlopen(BASE, timeout=1) as response:
            html = response.read().decode('utf-8')
        if '<title>Văn phòng AI</title>' not in html:
            raise RuntimeError('Port 3300 is used by another application.')
        return True
    except urllib.error.HTTPError as error:
        raise RuntimeError('Port 3300 is used by another application.') from error
    except urllib.error.URLError:
        return False


def desktop_entry():
    def quote(value):
        return '"' + str(value).replace('\\', '\\\\').replace('"', '\\"').replace('`', '\\`').replace('$', '\\$') + '"'
    # Desktop Exec expands % field codes even inside quoted arguments.
    command = ' '.join(quote(value).replace('%', '%%') for value in ['/usr/bin/python3', ROOT / 'scripts/launch.py'])
    entry = ('[Desktop Entry]\nVersion=1.0\nType=Application\nName=Agent Office\n'
             'Comment=Văn phòng AI 3D\n'
             f'Exec={command}\nIcon=applications-development\nTerminal=true\n'
             'Categories=Development;\nStartupWMClass=AgentOffice\n')
    applications = Path(os.environ.get('XDG_DATA_HOME', Path.home() / '.local/share')) / 'applications'
    applications.mkdir(parents=True, exist_ok=True)
    (applications / 'agent-office.desktop').write_text(entry)
    xdg = shutil.which('xdg-user-dir')
    desktop = Path.home() / 'Desktop'
    if xdg:
        result = subprocess.run([xdg, 'DESKTOP'], text=True, capture_output=True)
        if result.returncode == 0 and result.stdout.strip():
            desktop = Path(result.stdout.strip())
    if desktop.is_dir() and desktop != Path.home():
        shortcut = desktop / 'agent-office.desktop'
        shortcut.write_text(entry)
        shortcut.chmod(0o755)
        if shutil.which('gio'):
            subprocess.run(['gio', 'set', str(shortcut), 'metadata::trusted', 'true'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def open_window(url, env):
    for name in ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']:
        browser = shutil.which(name)
        if browser:
            with (DATA / 'app.log').open('a') as log:
                subprocess.run([browser, '--user-data-dir=' + str(DATA / 'chrome-profile'),
                                '--class=AgentOffice', '--no-first-run', '--no-default-browser-check',
                                '--app=' + url], env=env, stdout=log, stderr=log, check=True)
            return
    if not shutil.which('xdg-open'):
        raise RuntimeError('Install Chrome/Chromium for an app window, or a browser with xdg-open. Launch URL is in ~/.agent-office/url.txt.')
    print('Chrome/Chromium not found; opening the default browser.', flush=True)
    subprocess.run(['xdg-open', url], env=env, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--setup-only', action='store_true', help='install dependencies, build and create shortcuts without starting the server')
    parser.add_argument('--no-open', action='store_true', help='start the server without opening a window')
    args = parser.parse_args()
    if platform.system() != 'Linux':
        raise RuntimeError('This launcher supports Linux. On Windows, use launch.cmd.')
    DATA.mkdir(parents=True, exist_ok=True)
    with (DATA / 'launch.lock').open('w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        node = node_runtime()
        env = os.environ.copy()
        env['PATH'] = str(node.parent) + ':' + str(Path.home() / '.local/bin') + ':' + env.get('PATH', '')
        prepare(node, env)
        desktop_entry()
        claude = shutil.which('claude', path=env['PATH'])
        if not claude:
            print('Claude Code is not installed. The UI can open; install Claude Code and sign in before creating agents.', flush=True)
        if args.setup_only:
            print('Setup complete. Run ./launch.sh to open Agent Office.', flush=True)
            return
        if not server_running():
            with (DATA / 'server.log').open('a') as log:
                proc = subprocess.Popen([str(node), 'server/index.mjs'], cwd=ROOT, env=env,
                                        stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
            (DATA / 'server.pid').write_text(str(proc.pid) + '\n')
            for _ in range(100):
                if server_running():
                    break
                if proc.poll() is not None:
                    raise RuntimeError('Server failed to start. See ~/.agent-office/server.log.')
                time.sleep(0.1)
            else:
                raise RuntimeError('Server startup timed out. See ~/.agent-office/server.log.')
        url = (DATA / 'url.txt').read_text().strip()
        parsed = urllib.parse.urlparse(url)
        if parsed.scheme != 'http' or parsed.hostname != '127.0.0.1' or parsed.port != 3300:
            raise RuntimeError('Invalid local launch URL. Check ~/.agent-office/url.txt.')
    print('Agent Office is running. Launch URL: ~/.agent-office/url.txt', flush=True)
    if not args.no_open:
        open_window(url, env)


if __name__ == '__main__':
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError, ValueError) as error:
        print(f'Agent Office: {error}', file=__import__('sys').stderr)
        raise SystemExit(1)
