import type { ClientMessage, ServerMessage } from './types';

/** WebSocket to the local server, reconnecting with backoff. The token comes
 *  from the URL the server prints (…/?token=…). */
export class Connection {
  private ws: WebSocket | null = null;
  private retry = 250;
  private queue: ClientMessage[] = [];
  onMessage: (msg: ServerMessage) => void = () => {};
  onState: (connected: boolean) => void = () => {};

  constructor(private readonly token: string) {
    this.open();
  }

  private open(): void {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${location.host}/ws?token=${encodeURIComponent(this.token)}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 250;
      this.onState(true);
      for (const m of this.queue.splice(0)) ws.send(JSON.stringify(m));
    };
    ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(String(e.data)) as ServerMessage);
      } catch {
        // ignore malformed frames
      }
    };
    ws.onclose = () => {
      this.onState(false);
      setTimeout(() => this.open(), this.retry);
      this.retry = Math.min(this.retry * 2, 4000);
    };
  }

  send(msg: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
    else this.queue.push(msg);
  }
}
