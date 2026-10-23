# Agent Office

A 3D office where real Claude Code agents work in rooms by role. Lead, Dev,
Test and Review each have a room; the Lead's sub-agents walk to the room that
matches their task.

## Run

- Shortcut **Văn phòng AI** (Desktop / Start Menu) → `launch.ps1`: starts the
  server hidden on port 3300 and opens an app window.
- Manually: `npm start`, then open the URL printed (also in
  `~/.agent-office/url.txt`; it carries the access token).

## Build

```
npm install
npm run build      # typecheck + vite build → web/dist (served by the server)
npm run dev        # vite dev server for UI work (no agents)
```

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
