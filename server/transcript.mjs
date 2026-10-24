// Follows one Claude Code session transcript (~/.claude/projects/*/<id>.jsonl)
// and turns its records into agent activity: which tool is running, when a
// turn ends, and which sub-agents are out working.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');
const POLL_MS = 600;
const SUBAGENT_TOOLS = new Set(['Agent', 'Task']);
/** A background sub-agent's finish arrives later as a <task-notification>. */
const NOTIFICATION_RE = /<task-notification>[\s\S]*?<tool-use-id>([^<]+)<\/tool-use-id>/g;

function baseName(p) {
  return typeof p === 'string' ? path.basename(p) : '';
}

/** Short Vietnamese status line for a tool call. */
export function describeTool(name, input = {}) {
  switch (name) {
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return `Đang sửa ${baseName(input.file_path ?? input.notebook_path)}`.trim();
    case 'Read':
      return `Đang đọc ${baseName(input.file_path)}`.trim();
    case 'Grep':
    case 'Glob':
      return 'Đang tìm trong code';
    case 'Bash':
    case 'PowerShell':
      return input.description ? `Đang chạy: ${input.description}` : 'Đang chạy lệnh';
    case 'WebSearch':
    case 'WebFetch':
      return 'Đang tra cứu web';
    case 'Agent':
    case 'Task':
      return `Giao việc: ${input.description ?? 'sub-agent'}`;
    case 'TodoWrite':
      return 'Đang lập kế hoạch';
    default:
      return `Đang dùng ${name}`;
  }
}

export class TranscriptWatcher {
  /**
   * @param {string} sessionId
   * @param {(e: object) => void} onEvent  receives
   *   { kind: 'tool', label } | { kind: 'thinking' } | { kind: 'turnEnd' } |
   *   { kind: 'subagentStart', id, label, room } | { kind: 'subagentEnd', id }
   * @param {(description: string, subagentType: string) => string} classify
   *   picks the room a sub-agent walks to
   */
  constructor(sessionId, onEvent, classify) {
    this.sessionId = sessionId;
    this.onEvent = onEvent;
    this.classify = classify;
    this.file = null;
    this.offset = 0;
    this.partial = '';
    this.openTools = new Map();
    this.subagents = new Set();
    /** Sub-agents still working after their tool call returned. */
    this.background = new Set();
    this.timer = setInterval(() => this.poll(), POLL_MS);
  }

  dispose() {
    clearInterval(this.timer);
  }

  locate() {
    let dirs = [];
    try {
      dirs = fs.readdirSync(PROJECTS_DIR);
    } catch {
      return null;
    }
    for (const d of dirs) {
      const f = path.join(PROJECTS_DIR, d, `${this.sessionId}.jsonl`);
      if (fs.existsSync(f)) return f;
    }
    return null;
  }

  poll() {
    if (!this.file) {
      this.file = this.locate();
      if (!this.file) return;
    }
    let size;
    try {
      size = fs.statSync(this.file).size;
    } catch {
      return;
    }
    if (size <= this.offset) return;
    const fd = fs.openSync(this.file, 'r');
    try {
      const buf = Buffer.alloc(size - this.offset);
      fs.readSync(fd, buf, 0, buf.length, this.offset);
      this.offset = size;
      const text = this.partial + buf.toString('utf8');
      const lines = text.split('\n');
      // The last line may still be mid-write; keep it for the next poll.
      this.partial = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          this.handle(JSON.parse(line));
        } catch {
          // Malformed or partial record — skip it.
        }
      }
    } finally {
      fs.closeSync(fd);
    }
  }

  handle(rec) {
    // Sidechain records are sub-agents' own turns; the lead's tool_use /
    // tool_result pair already tracks when each one starts and finishes.
    if (rec.isSidechain) return;

    // A notification that arrives while the lead is busy is queued, and may
    // only ever be logged here rather than as a user record.
    if (rec.type === 'queue-operation' && rec.operation === 'enqueue') {
      this.handleNotifications(rec.content);
      return;
    }
    if (rec.type === 'attachment' && rec.attachment?.type === 'queued_command') {
      this.handleNotifications(rec.attachment.prompt);
      return;
    }

    if (rec.type === 'system' && rec.subtype === 'turn_duration') {
      this.openTools.clear();
      // Foreground sub-agents cannot outlive the turn; background ones can.
      for (const id of this.subagents) {
        if (!this.background.has(id)) this.endSubagent(id);
      }
      this.onEvent({ kind: 'turnEnd' });
      return;
    }

    const content = rec.message?.content;
    if (rec.type === 'user') {
      this.handleNotifications(content);
      if (typeof content === 'string') {
        this.onEvent({ kind: 'thinking' });
        return;
      }
      if (!Array.isArray(content)) return;
      let sawPrompt = false;
      for (const item of content) {
        if (item.type === 'tool_result') {
          this.openTools.delete(item.tool_use_id);
          if (!this.subagents.has(item.tool_use_id)) continue;
          if (rec.toolUseResult?.isAsync) this.background.add(item.tool_use_id);
          else this.endSubagent(item.tool_use_id);
        } else if (item.type === 'text') {
          sawPrompt = true;
        }
      }
      if (sawPrompt) this.onEvent({ kind: 'thinking' });
      else if (this.openTools.size === 0) this.onEvent({ kind: 'thinking' });
      return;
    }

    if (rec.type === 'assistant' && Array.isArray(content)) {
      this.handleAssistant(rec, content);
    }
  }

  endSubagent(id) {
    this.background.delete(id);
    if (this.subagents.delete(id)) this.onEvent({ kind: 'subagentEnd', id });
  }

  handleNotifications(content) {
    const text = typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.filter((i) => i.type === 'text').map((i) => i.text).join('\n')
        : '';
    for (const m of text.matchAll(NOTIFICATION_RE)) this.endSubagent(m[1].trim());
  }

  handleAssistant(rec, content) {
    let usedTool = false;
    for (const item of content) {
      if (item.type !== 'tool_use') continue;
      usedTool = true;
      const label = describeTool(item.name, item.input);
      this.openTools.set(item.id, label);
      if (SUBAGENT_TOOLS.has(item.name)) {
        this.subagents.add(item.id);
        this.onEvent({
          kind: 'subagentStart',
          id: item.id,
          label: item.input?.description ?? 'sub-agent',
          room: this.classify(item.input?.description ?? '', item.input?.subagent_type ?? ''),
        });
      }
      this.onEvent({ kind: 'tool', label });
    }
    if (!usedTool && rec.message?.stop_reason === 'end_turn') {
      this.onEvent({ kind: 'turnEnd' });
    } else if (!usedTool) {
      this.onEvent({ kind: 'thinking' });
    }
  }
}
