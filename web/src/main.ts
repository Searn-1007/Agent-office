import { Connection } from './net';
import { Office } from './office';
import { TerminalDock } from './terminal';
import { TEMPLATES } from './setup';
import type { AgentInfo } from './types';
import { Ui } from './ui';

const params = new URLSearchParams(location.search);
const token = params.get('token') ?? sessionStorage.getItem('agent-office-token') ?? '';
if (token) sessionStorage.setItem('agent-office-token', token);

const office = new Office(document.getElementById('scene')!, document.getElementById('labels')!);
const conn = new Connection(token);
const agents = new Map<number, AgentInfo>();
/** Set when this window hires an agent, so its terminal opens on arrival. */
let pendingOpen = false;

const ui = new Ui(document.getElementById('ui')!, {
  onView: (view) => office.setView(view),
  onSetup: (setup) => conn.send({ type: 'setSetup', setup }),
  onDeleteSetup: (name) => conn.send({ type: 'deleteSetup', name }),
  onCreate: (name, roomId, cwd) => {
    pendingOpen = true;
    conn.send({ type: 'createAgent', name, roomId, cwd });
  },
  onAddDir: (path) => conn.send({ type: 'addDir', path }),
  onOpenAgent: (id) => openAgent(id),
  onCloseAgent: (id) => conn.send({ type: 'closeAgent', id }),
});
const dock = new TerminalDock(ui.termHost, conn);
// Something to look at behind the setup screen until the server answers.
office.setSetup(TEMPLATES[0]);
let askedSetup = false;
let builtSetup = '';
/** Rebuild the building only when the rooms actually changed. */
function applySetup(setup: import('./setup').Setup | null): void {
  const key = JSON.stringify(setup);
  if (!setup || key === builtSetup) return;
  builtSetup = key;
  office.setSetup(setup);
}
office.onPick = (id) => openAgent(id);

function openAgent(id: number): void {
  if (!agents.has(id)) return;
  ui.openDrawer(id);
  dock.show(id);
  office.focusAgent(id);
}

function publish(): void {
  const list = [...agents.values()].sort((a, b) => a.id - b.id);
  ui.setAgents(list);
  office.syncAgents(list);
}

conn.onState = (ok) => ui.setConnected(ok);
conn.onMessage = (msg) => {
  switch (msg.type) {
    case 'hello':
      agents.clear();
      for (const a of msg.agents) agents.set(a.id, a);
      ui.setDirs(msg.dirs);
      ui.setSetup(msg.setup, msg.savedSetups);
      applySetup(msg.setup);
      publish();
      // Every launch starts by choosing what the office does today.
      if (!askedSetup) {
        askedSetup = true;
        ui.openSetup();
      }
      break;
    case 'setup':
      ui.setSetup(msg.setup, msg.savedSetups);
      applySetup(msg.setup);
      publish();
      break;
    case 'agent': {
      const isNew = !agents.has(msg.agent.id);
      agents.set(msg.agent.id, msg.agent);
      publish();
      // Open the terminal of an agent this window just hired.
      if (isNew && pendingOpen) {
        pendingOpen = false;
        openAgent(msg.agent.id);
      }
      break;
    }
    case 'agentRemoved':
      agents.delete(msg.id);
      dock.remove(msg.id);
      publish();
      break;
    case 'term':
      dock.feed(msg.id, msg.data);
      break;
    case 'replay':
      dock.replay(msg.id, msg.data);
      break;
    case 'dirs':
      ui.setDirs(msg.dirs);
      break;
    case 'error':
      ui.error(msg.message);
      break;
  }
};

setInterval(() => ui.setFps(office.fps), 1000);

if (!token) ui.error('Thiếu token — hãy mở bằng shortcut hoặc link server in ra.');
