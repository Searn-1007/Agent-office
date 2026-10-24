// Agent lifecycle: one Claude Code process per agent in a PTY, a headless
// terminal mirror to read its screen, and a transcript watcher for activity.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import pty from '@lydell/node-pty';
import xtermHeadless from '@xterm/headless';

import { buildPrompt, findRoom, roomForSubagent } from './roles.mjs';
import { TranscriptWatcher } from './transcript.mjs';

const { Terminal } = xtermHeadless;

const REPLAY_LIMIT = 400_000;
const SCREEN_CHECK_MS = 400;
/** What Claude Code's approval prompts look like on screen. */
const APPROVAL_RE =
  /Do you want to (proceed|make this edit|create|allow|run|overwrite)|Do you trust the files|Is this a project you created or one you trust\?|Yes, I trust this folder|❯\s*1\.\s*Yes/;

function launchCommand(sessionId, promptFile, name) {
  const args = ['--session-id', sessionId, '--append-system-prompt-file', promptFile, '-n', name];
  // npm puts claude.cmd on PATH on Windows; a PTY can only spawn it via cmd.
  if (process.platform === 'win32') return { file: 'cmd.exe', args: ['/c', 'claude', ...args] };
  return { file: 'claude', args };
}

export class AgentManager {
  /**
   * @param {string} dataDir  where role prompt files are written
   * @param {(msg: object) => void} broadcast
   */
  constructor(dataDir, broadcast) {
    this.dataDir = dataDir;
    this.broadcast = broadcast;
    this.agents = new Map();
    this.nextId = 1;
  }

  list() {
    return [...this.agents.values()].map((a) => this.publicState(a));
  }

  publicState(a) {
    return {
      id: a.id,
      name: a.name,
      roomId: a.roomId,
      cwd: a.cwd,
      status: a.status,
      activity: a.activity,
      subagents: [...a.subagents.values()],
      exited: a.exited,
    };
  }

  emit(a) {
    this.broadcast({ type: 'agent', agent: this.publicState(a) });
  }

  /** @param {{ name: string, roomId: string, cwd: string, setup: object }} opts */
  create({ name, roomId, cwd, setup }) {
    const room = findRoom(setup, roomId);
    if (!room) throw new Error('Phòng không tồn tại trong thiết lập hiện tại');
    if (!cwd || !fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      throw new Error(`Thư mục không tồn tại: ${cwd}`);
    }
    const id = this.nextId++;
    const sessionId = crypto.randomUUID();
    const promptFile = path.join(this.dataDir, `prompt-${id}.txt`);
    fs.writeFileSync(promptFile, buildPrompt(setup, room), 'utf8');
    const display = (name || `${room.label} ${id}`).slice(0, 40);
    const { file, args } = launchCommand(sessionId, promptFile, display);

    const cols = 110;
    const rows = 32;
    const proc = pty.spawn(file, args, {
      name: 'xterm-256color',
      cols,
      rows,
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
    });
    const mirror = new Terminal({ cols, rows, allowProposedApi: true });

    const a = {
      id,
      name: display,
      roomId,
      cwd,
      sessionId,
      proc,
      mirror,
      replay: '',
      status: 'starting',
      activity: 'Đang khởi động',
      subagents: new Map(),
      exited: false,
      approval: false,
    };
    this.agents.set(id, a);

    proc.onData((data) => {
      a.replay = (a.replay + data).slice(-REPLAY_LIMIT);
      mirror.write(data);
      this.broadcast({ type: 'term', id, data });
    });
    proc.onExit(() => {
      // close() kills the PTY and removes the agent first; announcing the exit
      // afterwards would bring a ghost back into every client.
      if (this.agents.get(id) !== a) return;
      a.exited = true;
      a.status = 'exited';
      a.activity = 'Đã thoát';
      a.subagents.clear();
      a.watcher.dispose();
      clearInterval(a.screenTimer);
      this.emit(a);
    });

    // The setup can change while agents run; sub-agents route by the current one.
    a.watcher = new TranscriptWatcher(
      sessionId,
      (e) => this.onTranscript(a, e),
      (desc, type) => roomForSubagent(this.setup ?? setup, roomId, desc, type),
    );
    a.screenTimer = setInterval(() => this.checkScreen(a), SCREEN_CHECK_MS);
    this.emit(a);
    return this.publicState(a);
  }

  onTranscript(a, e) {
    if (a.exited) return;
    switch (e.kind) {
      case 'tool':
        a.status = a.approval ? 'approval' : 'working';
        a.activity = e.label;
        break;
      case 'thinking':
        a.status = a.approval ? 'approval' : 'working';
        a.activity = 'Đang suy nghĩ';
        break;
      case 'turnEnd':
        a.status = 'done';
        a.activity = 'Xong, chờ bạn';
        a.subagents.clear();
        break;
      case 'subagentStart':
        a.subagents.set(e.id, { id: e.id, label: e.label, roomId: e.room });
        break;
      case 'subagentEnd':
        a.subagents.delete(e.id);
        break;
    }
    this.emit(a);
  }

  /** Approval prompts only show on screen, so read the mirror. */
  checkScreen(a) {
    if (a.exited) return;
    const buf = a.mirror.buffer.active;
    let text = '';
    for (let i = 0; i < a.mirror.rows; i++) {
      text += (buf.getLine(buf.viewportY + i)?.translateToString(true) ?? '') + '\n';
    }
    const approval = APPROVAL_RE.test(text);
    if (a.status === 'starting' && text.trim()) {
      a.status = 'idle';
      a.activity = 'Sẵn sàng';
      this.emit(a);
    }
    if (approval === a.approval) return;
    a.approval = approval;
    if (approval) {
      a.status = 'approval';
      a.activity = /Do you trust|Is this a project you created or one you trust\?|Yes, I trust this folder/.test(text)
        ? 'Cần xác nhận thư mục' : 'Cần bạn duyệt';
    } else if (a.status === 'approval') {
      a.status = 'working';
      a.activity = 'Đang làm';
    }
    this.emit(a);
  }

  input(id, data) {
    const a = this.agents.get(id);
    if (a && !a.exited) a.proc.write(data);
  }

  resize(id, cols, rows) {
    const a = this.agents.get(id);
    if (!a || a.exited || !(cols > 0) || !(rows > 0)) return;
    a.proc.resize(cols, rows);
    a.mirror.resize(cols, rows);
  }

  replay(id) {
    return this.agents.get(id)?.replay ?? '';
  }

  close(id) {
    const a = this.agents.get(id);
    if (!a) {
      // Unknown here (e.g. a ghost a client still shows): let clients drop it.
      this.broadcast({ type: 'agentRemoved', id });
      return;
    }
    if (!a.exited) {
      try {
        a.proc.kill();
      } catch {
        // already gone
      }
    }
    a.watcher.dispose();
    clearInterval(a.screenTimer);
    fs.rmSync(path.join(this.dataDir, `prompt-${id}.txt`), { force: true });
    this.agents.delete(id);
    this.broadcast({ type: 'agentRemoved', id });
  }

  disposeAll() {
    for (const id of [...this.agents.keys()]) this.close(id);
  }
}
