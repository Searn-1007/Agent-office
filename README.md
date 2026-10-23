# Agent Office

A 3D office for working with Claude Code agents. Each agent has a role, a room,
and its own terminal. Watch their activity and manage their work from the office.

**You do not need to create shortcuts or install Node.js yourself.** Download the
repository and run the launcher once. It prepares the application and creates
**Agent Office** shortcuts automatically. After that, open the app from a shortcut.

## Requirements

- Windows or Ubuntu, on x64 or ARM64 hardware.
- Internet access for the first launch to download the runtime and dependencies.
- Windows: PowerShell; Microsoft Edge or Google Chrome for a separate app window.
- Ubuntu: Python 3; Google Chrome or Chromium for a separate app window.
- To run agents: Claude Code installed and signed in with your own account.
  See [Connect Claude Code](#connect-claude-code).

The launcher downloads Node.js if a suitable version is not available. This does
not require Administrator access or `sudo`. Installing Python 3 through Ubuntu's
package manager may require `sudo` if Python is missing.

Windows and Ubuntu use different launcher files, but both automate environment
setup. The Ubuntu launcher has been tested. The Windows launcher has not yet been
tested directly on Windows. There is currently no macOS launcher.

## Install and launch on Windows

### Step 1: Download the application

Choose either method:

**Option A — download a ZIP, without Git:**

1. Open the [Agent Office repository](https://github.com/Searn-1007/Agent-office).
2. Click **Code → Download ZIP**.
3. Extract the archive into a folder you intend to keep, such as `C:\Apps\Agent-office`.
4. Open the extracted folder containing `launch.cmd`, `launch.ps1`, and `package.json`.

**Option B — clone with Git, if Git is already installed:**

Open PowerShell or Terminal in the folder where you want to store the application:

```powershell
git clone https://github.com/Searn-1007/Agent-office.git
cd Agent-office
```

### Step 2: Run the launcher once

1. Double-click **`launch.cmd`** inside the application folder.
2. A command window opens to prepare the app. Keep it open and wait for setup to finish.
3. The launcher downloads Node.js if needed, installs dependencies, and builds the interface.
4. The office opens in a separate app window when Edge or Chrome is found.
   Otherwise, it opens in your default browser.
5. After the app opens successfully, the launcher automatically creates **Agent Office**
   shortcuts on your **Desktop** and in the **Start Menu**.

You do not need to run `npm install`, run `npm run build`, or create shortcuts manually.
If setup fails, the command window keeps the error visible so you can read it.

### Step 3: Open the app next time

Double-click **Agent Office** on the Desktop, or search for **Agent Office** in the
Start Menu. You do not need to open the source folder or enter commands each time.

The Windows launcher currently checks dependencies and builds the interface on
each launch, so there may be a short delay before the app window appears.

## Install and launch on Ubuntu

### Step 1: Download the application

If Git is installed, open Terminal in the folder where you want to store the app:

```bash
git clone https://github.com/Searn-1007/Agent-office.git
cd Agent-office
```

Alternatively, select **Code → Download ZIP** in the
[repository](https://github.com/Searn-1007/Agent-office), extract the archive, and
open Terminal in the folder containing `launch.sh`. You can usually right-click
inside the folder and select **Open in Terminal**.

### Step 2: Run the launcher once

From Terminal in the application folder, run:

```bash
bash launch.sh
```

The launcher will:

1. Find a suitable Node.js installation or download a private runtime for Agent Office.
2. Install dependencies and build the interface.
3. Automatically create **Agent Office** shortcuts in the application menu and
   on the Desktop, if a Desktop directory is configured.
4. Start the server and open the office window.

Wait for the office to appear. The first launch downloads files and may take longer.
If you cloned with Git, you can also run `./launch.sh` directly.

### Step 3: Open the app next time

- Press **Super** (the Windows key), search for **Agent Office**, and open it; or
- Double-click the **Agent Office** shortcut on the Desktop.

If Ubuntu blocks the Desktop shortcut, right-click it and select **Allow Launching**.
The launcher has already created the shortcut; this step allows your desktop to use it.

Ubuntu reuses dependencies and the build when nothing has changed. If Chrome or
Chromium is unavailable, the app opens in your default browser. The shortcut may
also open a Terminal window to display progress or errors.

## Connect Claude Code

The office interface can open without Claude Code. To have agents perform work,
Claude Code must be installed and signed in on your machine.

1. Install Claude Code using the [official setup guide](https://code.claude.com/docs/en/setup).
2. Open a new Terminal or PowerShell window after installation.
3. Run:

   ```text
   claude
   ```

4. Follow Claude Code's sign-in instructions using your own account.
5. Check your authentication status:

   ```text
   claude auth status
   ```

6. If Agent Office was already running before you installed Claude Code, stop its
   server as described below, then reopen the shortcut so it picks up the new environment.

The launcher does not install Claude Code or sign in for you. Each user needs their
own Claude account and access.

On Linux, desktop shortcuts may have a different `PATH` from your terminal. The
launcher also searches `~/.local/bin`, `~/.npm-global/bin`, and the `bin` directory
of `NPM_CONFIG_PREFIX` (or `npm_config_prefix`) when that variable is set. For a
custom installation elsewhere, add its `bin` directory to the desktop session
`PATH`. Restart an already running Agent Office server after changing its environment.

## Start working in the office

The current interface uses Vietnamese labels. Their English meanings are included
below so you can follow the steps:

1. Choose an office template and optionally customize its name and rooms.
2. Click **Vào văn phòng →** (Enter office).
3. Click **+ Thêm agent** (Add agent).
4. Choose a role/room, enter a name, and select the project folder the agent should
   work in. To add another folder, paste its path and click **Lưu thư mục** (Save folder).
5. Click **Tuyển agent** (Create agent) to start Claude Code.
6. Open the agent's terminal and enter your task. If Claude Code asks you to trust
   a folder or approve an action, review the request and respond in that terminal.

## Shortcuts, installation folders, and closing the app

- **Shortcuts are created automatically during the first successful launcher run.**
  Cloning or extracting the repository alone does not create them, because no
  setup code has run yet.
- Keep the application folder in place. Shortcuts point to that folder, so deleting
  or moving it will break them.
- If you move the folder, rerun `launch.cmd` or `bash launch.sh` from the new location
  to update the shortcuts. Stop the old server before switching to the new location.
- Closing the office window closes the interface. The background server and its
  agents may keep running. Open the shortcut again to return to the running office.
- Stopping the server closes every agent it started. Restarting the server does not
  automatically restore those agent processes.

### Stop the server on Ubuntu

Run this only when you want to stop the office and its agents:

```bash
kill -TERM "$(cat ~/.agent-office/server.pid)"
```

### Stop the server on Windows

Open **Task Manager → Details**, enable the **Command line** column, and find the
`node.exe` process whose command line points to `Agent-office\server\index.mjs`
in your installation folder. Select that process and click **End task**.

## Update the application

If you installed with Git, finish any active agent work and stop the server.
Open Terminal or PowerShell in the application folder and run:

```text
git pull
```

Then open the shortcut or rerun the launcher. It handles dependency updates and
builds for you; you do not need to run npm commands yourself.

If you downloaded a ZIP, stop the server, download the new ZIP, and extract it into
a new folder. Run the launcher there to update the shortcuts. Personal settings
are stored outside the repository and are preserved when you change source folders.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| No shortcut after downloading the repository | Run `launch.cmd` on Windows or `bash launch.sh` on Ubuntu once and wait for setup to finish. |
| Node.js download or dependency installation fails | Check your internet connection, read the error in the command window, and rerun the launcher. |
| Ubuntu reports that `python3` is missing | Run `sudo apt install python3`, then retry `bash launch.sh`. |
| Ubuntu reports `Permission denied` for `./launch.sh` | Use `bash launch.sh`, or run `chmod +x launch.sh` and try again. |
| The Ubuntu Desktop shortcut will not open | Right-click it and select **Allow Launching**, or open the app from the application menu. |
| The office opens in a browser tab | The launcher did not find a browser supporting app windows. Use Chrome/Chromium on Ubuntu or Edge/Chrome on Windows. |
| Claude Code cannot be found | Install Claude Code, check `claude auth status`, stop the old server, and reopen Agent Office. |
| Port `3300` is occupied by another application | Stop the application using that port, then rerun the launcher. |
| The interface displays “Mất kết nối…” (Disconnected) | Reopen the shortcut to use the correct token-bearing URL and start the server if needed. Check the logs if it still fails. |
| A shortcut stops working after you move the application | Rerun the launcher from the new folder to recreate the shortcuts. |

### Logs and settings

| Data | Ubuntu | Windows |
| --- | --- | --- |
| Settings, tokens, and private runtime | `~/.agent-office/` | `%USERPROFILE%\.agent-office\` |
| Server log | `~/.agent-office/server.log` | `%USERPROFILE%\.agent-office\server.log` |
| Separate server error log | Included in `server.log` | `%USERPROFILE%\.agent-office\server-error.log` |
| App window log | `~/.agent-office/app.log` | No separate app log |
| Launch URL containing the access token | `~/.agent-office/url.txt` | `%USERPROFILE%\.agent-office\url.txt` |

On Windows, paste `%USERPROFILE%\.agent-office` into the File Explorer address bar
to open the data folder. On Ubuntu, `~` refers to your home directory.

Settings and tokens stay outside the repository. Do not commit that data folder
or share the token-bearing launch URL. For normal use, open the shortcut to get
the correct URL automatically.

## Development

These instructions are for editing the source. Regular users only need the launcher.
For manual development, install Node.js 22.12+ and npm on your PATH.

```bash
npm ci
npm run build   # TypeScript checks and interface build into web/dist
npm test        # Server regression tests
npm start       # Start the server and serve the built interface
```

`npm run dev` starts Vite for interface development; it does not start agents.
In Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

Ubuntu launcher options:

```bash
bash launch.sh --setup-only  # Prepare the runtime, dependencies, build, and shortcuts
bash launch.sh --no-open     # Start the server without opening an app window
```

Interface changes require a rebuild. Server changes require stopping and restarting
the server, which also closes any running agents.

### Project structure

- `launch.cmd`, `launch.ps1`: environment setup and app launch on Windows.
- `launch.sh`, `scripts/launch.py`: environment setup and app launch on Ubuntu/Linux.
- `server/agents.mjs`: starts each Claude Code agent in its own PTY and detects
  approval prompts using a headless terminal.
- `server/transcript.mjs`: follows Claude transcripts for activity, turn completion,
  and sub-agent events.
- `server/roles.mjs`: role prompts and sub-agent room assignments.
- `web/src/building.ts`: office layout and building geometry.
- `web/src/office.ts`: camera, navigation, and characters.
- `web/src/ui.ts`, `web/src/terminal.ts`: controls and terminal interface.
