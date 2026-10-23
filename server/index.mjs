// Agent Office server: serves the 3D UI and speaks one WebSocket protocol
// for agents and their terminals. Bound to 127.0.0.1 and gated by a token.

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { WebSocketServer } from 'ws';

import { AgentManager } from './agents.mjs';
import { validateSetup } from './roles.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STATIC_DIR = path.join(ROOT, 'web', 'dist');
const DATA_DIR = path.join(os.homedir(), '.agent-office');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
const PORT = Number(process.argv[process.argv.indexOf('--port') + 1]) || 3300;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

// ── Config (token + saved folders) ──────────────────────────────────────────

fs.mkdirSync(DATA_DIR, { recursive: true });

function loadConfig() {
  let cfg = {};
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    // first run
  }
  if (typeof cfg.token !== 'string') cfg.token = crypto.randomUUID();
  if (!Array.isArray(cfg.dirs)) {
    cfg.dirs = [{ name: 'Thư mục chính', path: os.homedir() }];
    // Pick up the folders already set up for Pixel Agents, if any.
    try {
      const pa = JSON.parse(
        fs.readFileSync(path.join(os.homedir(), '.pixel-agents', 'config.json'), 'utf8'),
      );
      for (const d of pa.directories ?? []) {
        if (d?.path && !cfg.dirs.some((x) => x.path === d.path)) cfg.dirs.push(d);
      }
    } catch {
      // no Pixel Agents config
    }
  }
  return cfg;
}

const config = loadConfig();
if (!Array.isArray(config.savedSetups)) config.savedSetups = [];
function saveConfig() {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), { mode: 0o600 });
}
saveConfig();

// ── HTTP ────────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let rel = decodeURIComponent(url.pathname);
  if (rel === '/') rel = '/index.html';
  const file = path.normalize(path.join(STATIC_DIR, rel));
  if (!file.startsWith(STATIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': rel.startsWith('/assets/') ? 'max-age=31536000, immutable' : 'no-cache',
  });
  fs.createReadStream(file).pipe(res);
});

// ── WebSocket ───────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ noServer: true });
const clients = new Set();

function send(ws, msg) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}
function broadcast(msg) {
  const raw = JSON.stringify(msg);
  for (const ws of clients) if (ws.readyState === ws.OPEN) ws.send(raw);
}

const agents = new AgentManager(DATA_DIR, broadcast);
agents.setup = config.setup ?? null;

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const host = (req.headers.host ?? '').split(':')[0];
  const tokenOk = url.searchParams.get('token') === config.token;
  const hostOk = host === '127.0.0.1' || host === 'localhost';
  if (url.pathname !== '/ws' || !tokenOk || !hostOk) {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
});

wss.on('connection', (ws) => {
  clients.add(ws);
  send(ws, {
    type: 'hello',
    agents: agents.list(),
    dirs: config.dirs,
    setup: config.setup ?? null,
    savedSetups: config.savedSetups,
  });
  ws.on('close', () => clients.delete(ws));
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    try {
      handle(ws, msg);
    } catch (err) {
      send(ws, { type: 'error', message: String(err instanceof Error ? err.message : err) });
    }
  });
});

function handle(ws, msg) {
  switch (msg.type) {
    case 'setSetup': {
      const setup = validateSetup(msg.setup);
      config.setup = setup;
      agents.setup = setup;
      // Keep the last few setups by name so they can be picked again.
      config.savedSetups = [setup, ...config.savedSetups.filter((s) => s.name !== setup.name)].slice(0, 12);
      saveConfig();
      broadcast({ type: 'setup', setup, savedSetups: config.savedSetups });
      break;
    }
    case 'deleteSetup':
      config.savedSetups = config.savedSetups.filter((s) => s.name !== String(msg.name));
      saveConfig();
      broadcast({ type: 'setup', setup: config.setup ?? null, savedSetups: config.savedSetups });
      break;
    case 'createAgent': {
      if (!config.setup) throw new Error('Chưa thiết lập văn phòng');
      agents.create({
        name: String(msg.name ?? ''),
        roomId: String(msg.roomId ?? ''),
        cwd: String(msg.cwd ?? ''),
        setup: config.setup,
      });
      break;
    }
    case 'input':
      agents.input(msg.id, String(msg.data ?? ''));
      break;
    case 'resize':
      agents.resize(msg.id, Math.floor(msg.cols), Math.floor(msg.rows));
      break;
    case 'replay':
      send(ws, { type: 'replay', id: msg.id, data: agents.replay(msg.id) });
      break;
    case 'closeAgent':
      agents.close(msg.id);
      break;
    case 'addDir': {
      const p = String(msg.path ?? '').trim();
      if (!p || !fs.existsSync(p) || !fs.statSync(p).isDirectory()) {
        throw new Error(`Thư mục không tồn tại: ${p}`);
      }
      if (!config.dirs.some((d) => d.path === p)) {
        config.dirs.push({ name: String(msg.name || path.basename(p)), path: p });
        saveConfig();
      }
      broadcast({ type: 'dirs', dirs: config.dirs });
      break;
    }
  }
}

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}/?token=${config.token}`;
  fs.writeFileSync(path.join(DATA_DIR, 'url.txt'), url);
  console.log(`[Agent Office] running at ${url}`);
});

function shutdown() {
  agents.disposeAll();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
