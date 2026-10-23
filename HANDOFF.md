# Handoff

State on 2026-10-24. Read README.md first for the architecture.

## Done
- Server (`server/`): one Claude Code PTY per agent (`cmd.exe /c claude --session-id … --append-system-prompt-file …` on Windows), status from the session JSONL transcript, approval prompts read from a headless xterm mirror, setups validated and saved in `~/.agent-office/config.json`.
- UI (`web/`): two-storey 3D office (Three.js), setup screen on every launch with templates in `web/src/setup.ts`, procedural toon chibi figures in `web/src/figures.ts`, terminal drawer (xterm), roster, activity feed, FPS readout.
- Performance: no `backdrop-filter`, frame cap 60/30 fps, adaptive quality, Edge launched with its own profile and `--force_high_performance_gpu` (`launch.ps1`).
- Launch: Desktop/Start Menu shortcut "Văn phòng AI" → `launch.ps1` → server on port 3300 (3301 is reserved by Windows).
- Git: local repo on `main`, one commit. **Not pushed yet**: no remote and no `gh` CLI installed.

## Next steps
1. Push: the user creates an empty repo at github.com/new (account Searn-1007), then run
   `git remote add origin https://github.com/Searn-1007/<repo>.git && git push -u origin main`.
2. Test with a real Claude Code agent. Only a mock `claude` has been used so far. Check that the status changes, approval detection (`APPROVAL_RE` in `server/agents.mjs`) and sub-agent routing (`roomForSubagent` in `server/roles.mjs`) work.
3. Ask the user where ROS 2 is installed (WSL or a separate Ubuntu machine) and put that in the ROS template prompts.
4. Optional: add a LICENSE, persist agents across server restarts (`claude --resume <sessionId>`).

## Testing tips
- Build: `npm run build`. The server serves `web/dist`, so no restart is needed for UI changes. Server changes need a restart, and restarting kills the running agents.
- End-to-end without real agents: put a mock `claude.cmd` on PATH and set a temp `USERPROFILE`/`HOME`, then start `node server/index.mjs --port 3302`. Add `&debug` to the URL to get `window.__office`.
