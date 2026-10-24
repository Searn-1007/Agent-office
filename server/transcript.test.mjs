import assert from 'node:assert/strict';
import test from 'node:test';

import { TranscriptWatcher } from './transcript.mjs';

function watcher() {
  const events = [];
  const w = new TranscriptWatcher('test', (e) => events.push(e), () => 'ros');
  w.dispose();
  return { w, events, kinds: () => events.map((e) => `${e.kind}${e.id ? ':' + e.id : ''}`) };
}

const spawn = (id, background) => ({
  type: 'assistant',
  message: {
    content: [{ type: 'tool_use', id, name: 'Agent', input: { description: 'ros: job', run_in_background: background } }],
  },
});
const result = (id, isAsync) => ({
  type: 'user',
  toolUseResult: isAsync ? { isAsync: true, status: 'async_launched' } : { status: 'completed' },
  message: { content: [{ type: 'tool_result', tool_use_id: id, content: 'ok' }] },
});
const turnEnd = { type: 'system', subtype: 'turn_duration' };
const notification = (id) => ({
  type: 'user',
  message: {
    content: `<task-notification>\n<task-id>a1</task-id>\n<tool-use-id>${id}</tool-use-id>\n<status>completed</status>\n</task-notification>`,
  },
});

test('a foreground sub-agent ends with its tool result', () => {
  const { w, kinds } = watcher();
  w.handle(spawn('t1', false));
  w.handle(result('t1', false));
  assert.ok(kinds().includes('subagentEnd:t1'));
});

test('a background sub-agent outlives its tool result and the turn', () => {
  const { w, kinds } = watcher();
  w.handle(spawn('t2', true));
  w.handle(result('t2', true));
  w.handle(turnEnd);
  assert.ok(!kinds().includes('subagentEnd:t2'));
  w.handle(notification('t2'));
  assert.equal(kinds().filter((k) => k === 'subagentEnd:t2').length, 1);
});

test('a queued notification ends a background sub-agent', () => {
  const { w, kinds } = watcher();
  w.handle(spawn('t4', true));
  w.handle(result('t4', true));
  w.handle({ type: 'queue-operation', operation: 'enqueue', content: notification('t4').message.content });
  w.handle({ type: 'attachment', attachment: { type: 'queued_command', prompt: notification('t4').message.content } });
  assert.equal(kinds().filter((k) => k === 'subagentEnd:t4').length, 1);
});

test('a turn end clears foreground sub-agents whose result was missed', () => {
  const { w, kinds } = watcher();
  w.handle(spawn('t3', false));
  w.handle(turnEnd);
  assert.ok(kinds().includes('subagentEnd:t3'));
});
