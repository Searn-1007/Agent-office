# Handoff

State on 2026-10-24. Read README.md first for the architecture.

## Done
- Server (`server/`): one Claude Code PTY per agent (`cmd.exe /c claude --session-id … --append-system-prompt-file …` on Windows), status from the session JSONL transcript, approval prompts read from a headless xterm mirror, setups validated and saved in `~/.agent-office/config.json`.
- UI (`web/`): two-storey 3D office (Three.js), setup screen on every launch with templates in `web/src/setup.ts`, procedural toon chibi figures in `web/src/figures.ts`, terminal drawer (xterm), roster, activity feed, FPS readout.
- Performance: no `backdrop-filter`, frame cap 60/30 fps, adaptive quality, Edge launched with its own profile and `--force_high_performance_gpu` (`launch.ps1`).
- Launch: Desktop/Start Menu shortcut "Văn phòng AI" → `launch.ps1` → server on port 3300 (3301 is reserved by Windows).
- Git: local repo on `main`. **Not pushed yet**: no remote and no `gh` CLI installed.

## Next steps
1. Push: create an empty GitHub repository, then run
   `git remote add origin <repository-url>` and `git push -u origin main`.
2. Test with a real Claude Code agent. Only a mock `claude` has been used so far. Check that the status changes, approval detection (`APPROVAL_RE` in `server/agents.mjs`) and sub-agent routing (`roomForSubagent` in `server/roles.mjs`) work.
3. Ask the user where ROS 2 is installed (WSL or a separate Ubuntu machine) and put that in the ROS template prompts.
4. Optional: add a LICENSE, persist agents across server restarts (`claude --resume <sessionId>`).

## Follow-up verification (2026-10-24)
- Launched real Claude Code 2.1.309 through `AgentManager`. Its new workspace trust screen was incorrectly reported as idle; updated approval detection and the Vietnamese activity label. No trust choice was submitted and no model task was run. Full tool/status/sub-agent verification remains pending.
- Added `server/agents.test.mjs`: three headless-terminal regression cases cover old/new trust screens, tool approval, and clearing approval. Run `node --test server/agents.test.mjs`.
- `npm.cmd test` and `npm.cmd run build` pass. Vite uses its runner config loader to avoid an esbuild parent-directory access error in the restricted environment; config root uses `import.meta.url`.
- Removed Pixel Agents config migration from the server. Removed its global npm package, Claude Code hooks, and redundant office shortcut on this machine. Only the correctly named office shortcut remains in the user's Start Menu.
- Verified old source/state ZIP backups in `~/.agent-office/cleanup-backup` (outside the repo). Recursive deletion of the old source/state directories was blocked by automatic sandbox approval policy. Run `finish-cleanup.ps1` in that backup folder locally to finish removal. No listener was found on the old port 3210 during cleanup.
- Git still has no remote. ROS 2 installation location remains unknown.

## Testing tips
- Build: `npm run build`. The server serves `web/dist`, so no restart is needed for UI changes. Server changes need a restart, and restarting kills the running agents.
- End-to-end without real agents: put a mock `claude.cmd` on PATH and set a temp `USERPROFILE`/`HOME`, then start `node server/index.mjs --port 3302`. Add `&debug` to the URL to get `window.__office`.
