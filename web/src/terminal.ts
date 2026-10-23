import '@xterm/xterm/css/xterm.css';

import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';

import type { Connection } from './net';

interface Pane {
  term: Terminal;
  fit: FitAddon;
  el: HTMLDivElement;
  opened: boolean;
}

/** One xterm per agent, docked in the side drawer; only the shown one is
 *  visible, but all keep receiving output so switching is instant. */
export class TerminalDock {
  private readonly panes = new Map<number, Pane>();
  private shown: number | null = null;

  constructor(
    private readonly host: HTMLElement,
    private readonly conn: Connection,
  ) {
    new ResizeObserver(() => this.refit()).observe(host);
  }

  private pane(id: number): Pane {
    let p = this.panes.get(id);
    if (p) return p;
    const term = new Terminal({
      fontFamily: 'Cascadia Mono, Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      scrollback: 5000,
      theme: { background: '#11131a', foreground: '#e6e8ef', cursor: '#e5383b', selectionBackground: '#3a3f55' },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.onData((data) => this.conn.send({ type: 'input', id, data }));
    const el = document.createElement('div');
    el.className = 'term-pane';
    el.hidden = true;
    this.host.appendChild(el);
    p = { term, fit, el, opened: false };
    this.panes.set(id, p);
    // Fetch everything the agent printed before this pane existed.
    this.conn.send({ type: 'replay', id });
    return p;
  }

  feed(id: number, data: string): void {
    this.panes.get(id)?.term.write(data);
  }

  replay(id: number, data: string): void {
    const p = this.pane(id);
    p.term.reset();
    p.term.write(data);
  }

  show(id: number): void {
    const p = this.pane(id);
    for (const [pid, other] of this.panes) other.el.hidden = pid !== id;
    if (!p.opened) {
      p.term.open(p.el);
      p.opened = true;
    }
    this.shown = id;
    requestAnimationFrame(() => {
      this.refit();
      p.term.focus();
    });
  }

  remove(id: number): void {
    const p = this.panes.get(id);
    if (!p) return;
    p.term.dispose();
    p.el.remove();
    this.panes.delete(id);
    if (this.shown === id) this.shown = null;
  }

  refit(): void {
    if (this.shown === null) return;
    const p = this.panes.get(this.shown);
    if (!p || !p.opened || p.el.hidden || this.host.clientWidth < 50) return;
    try {
      p.fit.fit();
      this.conn.send({ type: 'resize', id: this.shown, cols: p.term.cols, rows: p.term.rows });
    } catch {
      // not laid out yet
    }
  }
}
