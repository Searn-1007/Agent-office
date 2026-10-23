import assert from 'node:assert/strict';
import test from 'node:test';
import xtermHeadless from '@xterm/headless';
import { AgentManager } from './agents.mjs';

for (const prompt of [
  'Do you trust the files in this folder?',
  'Is this a project you created or one you trust?\r\n❯ No, exit\r\n  Yes, I trust this folder',
  'Do you want to proceed?',
]) {
  test(`detects approval: ${prompt.split('\r')[0]}`, async () => {
    const manager = new AgentManager('', () => {});
    const mirror = new xtermHeadless.Terminal({ cols: 110, rows: 32, allowProposedApi: true });
    try {
      const agent = { mirror, status: 'starting', approval: false, subagents: new Map() };
      await new Promise(resolve => mirror.write(prompt, resolve));
      manager.checkScreen(agent);
      assert.equal(agent.status, 'approval');
      assert.equal(agent.approval, true);
      assert.equal(agent.activity, prompt.includes('proceed') ? 'Cần bạn duyệt' : 'Cần xác nhận thư mục');
      await new Promise(resolve => mirror.write('\x1b[2J\x1b[HWorking', resolve));
      manager.checkScreen(agent);
      assert.equal(agent.approval, false);
      assert.equal(agent.status, 'working');
    } finally {
      mirror.dispose();
    }
  });
}
