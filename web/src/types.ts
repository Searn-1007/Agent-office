import type { Setup } from './setup';

export type AgentStatus = 'starting' | 'idle' | 'working' | 'approval' | 'done' | 'exited';

export interface SubagentInfo {
  id: string;
  label: string;
  roomId: string;
}

export interface AgentInfo {
  id: number;
  name: string;
  roomId: string;
  cwd: string;
  status: AgentStatus;
  activity: string;
  subagents: SubagentInfo[];
  exited: boolean;
}

export interface DirInfo {
  name: string;
  path: string;
}

export type ServerMessage =
  | { type: 'hello'; agents: AgentInfo[]; dirs: DirInfo[]; setup: Setup | null; savedSetups: Setup[] }
  | { type: 'setup'; setup: Setup | null; savedSetups: Setup[] }
  | { type: 'agent'; agent: AgentInfo }
  | { type: 'agentRemoved'; id: number }
  | { type: 'term'; id: number; data: string }
  | { type: 'replay'; id: number; data: string }
  | { type: 'dirs'; dirs: DirInfo[] }
  | { type: 'error'; message: string };

export type ClientMessage =
  | { type: 'setSetup'; setup: Setup }
  | { type: 'deleteSetup'; name: string }
  | { type: 'createAgent'; name: string; roomId: string; cwd: string }
  | { type: 'input'; id: number; data: string }
  | { type: 'resize'; id: number; cols: number; rows: number }
  | { type: 'replay'; id: number }
  | { type: 'closeAgent'; id: number }
  | { type: 'addDir'; path: string; name?: string };

export const STATUS_META: Record<AgentStatus, { label: string; css: string }> = {
  starting: { label: 'Đang khởi động', css: '#f4a261' },
  idle: { label: 'Sẵn sàng', css: '#9aa0b4' },
  working: { label: 'Đang làm', css: '#3a86ff' },
  approval: { label: 'Cần duyệt', css: '#e5383b' },
  done: { label: 'Xong', css: '#2ec27e' },
  exited: { label: 'Đã thoát', css: '#5c6070' },
};

/** Colour used for rooms an agent's setup no longer has. */
export const UNKNOWN_ROOM_COLOR = '#8d99ae';
