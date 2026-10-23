# Agent Office

A 3D office where real Claude Code agents work in rooms by role. Lead, Dev,
Test and Review each have a room; the Lead's sub-agents walk to the room that
matches their task.

## Quick start

Clone the repository, then run the launcher for your system:

```bash
git clone https://github.com/Searn-1007/Agent-office.git
cd Agent-office
./launch.sh
```

- **Ubuntu / Linux (x64 or ARM64):** run `./launch.sh` (requires Python 3).
- **Windows (x64 or ARM64):** double-click `launch.cmd`.

The first launch needs internet access. The launcher downloads a checksum-verified
Node.js 22 runtime if needed, installs dependencies, builds the interface, starts
the local server, and creates **Agent Office** shortcuts on the Desktop and in the
application menu. No administrator access is needed. Keep the repository in place;
the shortcuts point to it. Run the launcher again after `git pull` to update.

Chrome, Chromium or Edge opens the office in a separate app window. If none is
available, the launcher uses the default browser. Linux reuses its build until
sources change; Windows builds at each launch.

### Connect Claude Code

The office interface can open without Claude Code. To run real agents, install
[Claude Code](https://code.claude.com/docs/en/setup), launch `claude` once and sign in,
then reopen Agent Office. Each user uses their own Claude account and access.
The launcher does not install Claude Code or submit model tasks for you.

### Manual use and troubleshooting

- `./launch.sh --setup-only`: prepare Linux dependencies/build/shortcuts only.
- `./launch.sh --no-open`: start the Linux server without opening a window.
- With Node.js 22.12+ and npm installed: `npm ci`, `npm run build`, then `npm start`.
- Runtime data and the token-bearing launch URL are stored in `~/.agent-office`
  (`%USERPROFILE%\.agent-office` on Windows), outside the repository.
- Linux server logs: `~/.agent-office/server.log`; app logs: `~/.agent-office/app.log`.
  Windows also has `server-error.log` in the same directory.
- The server listens on `127.0.0.1:3300`. Keep this port free. It stays running
  after the app window closes so active agents can continue.
- To stop it, use the saved PID in `~/.agent-office/server.pid` on Linux, or stop
  its Node process in Task Manager on Windows. Stopping it closes its agents.
- Do not commit runtime data or share the token-bearing launch URL.

## Build

```
npm install
npm run build      # typecheck + vite build → web/dist (served by the server)
npm test           # server regression tests
npm run dev        # vite dev server for UI work (no agents)
```

Manual development requires Node.js 22.12+ and npm. Running agents also requires
Claude Code installed and signed in (`claude auth status`).
On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.
Runtime configuration and access tokens stay in `~/.agent-office`, outside this
repository. Do not commit that directory or share the token-bearing launch URL.

## How it works

- `server/agents.mjs` — one `claude --session-id … --append-system-prompt-file …`
  per agent in a PTY (`cmd.exe /c claude` on Windows). A headless xterm mirror
  reads the screen to spot approval prompts.
- `server/transcript.mjs` — follows `~/.claude/projects/*/<session>.jsonl` for
  tool activity, turn ends and sub-agent (Agent/Task) spawns. Nothing is
  written to `~/.claude/settings.json`.
- `server/roles.mjs` — role prompts and which room a sub-agent goes to
  (description starting with `test:` / `review:` / `dev:`).
- `web/src/building.ts` — room layout + static geometry merged per storey.
- `web/src/office.ts` — camera, routing (room → corridor → lift), figures.
- `web/src/ui.ts`, `terminal.ts` — panels and the xterm drawer.

Closing the server stops every agent it started.
