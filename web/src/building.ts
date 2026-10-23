/**
 * The office building: room slots, the rooms of the current setup, and the
 * static scene (geometry).
 *
 * Units are meters. +x runs left→right across the front, +z points toward the
 * camera, y is up. The building is a two-storey "doll house" whose front is
 * open, so every room is visible from the street. Five room slots hold the
 * setup's rooms (the coordinator gets the ground-floor corner); the pantry is
 * always there. Unused slots become a meeting room.
 *
 * All static boxes are merged into a few meshes per storey (one draw call
 * each), which is what keeps the scene light.
 */

import type { BufferGeometry } from 'three';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshLambertMaterial,
  PlaneGeometry,
  SphereGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import type { RoomRole, Setup, Theme } from './setup';

export const FLOOR_H = 3.4;
export const SLAB = 0.25;
export const BUILDING = { x0: -12, x1: 12, z0: -6, z1: 6 };
/** Front edge of the rooms; the corridor runs in front of it. */
export const ROOM_FRONT_Z = 3;
export const CORRIDOR_Z = 4.6;
export const ELEVATOR = { x: 11, z: 1.5 };
export const LOT = { x0: -24, x1: 24, z0: -15, z1: 18 };

const DESK_H = 0.62;
const SEAT_H = 0.4;

export type RoomKind = 'work' | 'meeting' | 'pantry';

export interface Seat {
  x: number;
  z: number;
  /** Yaw the figure faces when seated (0 = toward the camera, +z). */
  yaw: number;
  /** Desk seats type; lounge seats just sit. */
  desk: boolean;
  occupant: string | null;
}

export interface Room {
  id: string;
  name: string;
  level: 0 | 1;
  kind: RoomKind;
  def?: RoomRole;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  doorX: number;
  seats: Seat[];
  floorColor: number;
}

export function levelY(level: number): number {
  return level * FLOOR_H + SLAB;
}

// ── Layout ──────────────────────────────────────────────────────────────────

interface Slot {
  level: 0 | 1;
  x0: number;
  x1: number;
}
/** Fill order: coordinator's corner first, then upstairs, then the middle downstairs. */
const SLOTS: Slot[] = [
  { level: 0, x0: -12, x1: -4 },
  { level: 1, x0: -12, x1: -2 },
  { level: 1, x0: -2, x1: 4 },
  { level: 1, x0: 4, x1: 10 },
  { level: 0, x0: -4, x1: 4 },
];
const PANTRY: Slot = { level: 0, x0: 4, x1: 10 };

function deskSeats(x0: number, x1: number, rows: number[]): Seat[] {
  const seats: Seat[] = [];
  const pitch = 2.3;
  const count = Math.max(1, Math.floor((x1 - x0 - 0.8) / pitch));
  const start = (x0 + x1) / 2 - ((count - 1) * pitch) / 2;
  for (const deskZ of rows) {
    for (let i = 0; i < count; i++) {
      // Seated behind the desk, facing the camera, so faces show.
      seats.push({ x: start + i * pitch, z: deskZ - 0.7, yaw: 0, desk: true, occupant: null });
    }
  }
  return seats;
}

function tint(css: string, amount: number): number {
  return new Color(css).lerp(new Color(0xffffff), amount).getHex();
}

export function buildRooms(setup: Setup): Room[] {
  const defs = [...setup.rooms].sort((a, b) => Number(b.coordinator) - Number(a.coordinator));
  const rooms: Room[] = SLOTS.map((slot, i) => {
    const def = defs[i];
    const base = { level: slot.level, x0: slot.x0, x1: slot.x1, z0: -6, z1: ROOM_FRONT_Z, doorX: (slot.x0 + slot.x1) / 2 };
    if (!def) {
      const cx = (slot.x0 + slot.x1) / 2;
      return {
        ...base,
        id: `meeting${i}`,
        name: 'Phòng họp',
        kind: 'meeting' as const,
        floorColor: 0xece2cf,
        seats: [
          ...[-1.8, -0.6, 0.6, 1.8].map((dx) => ({ x: cx + dx, z: -3.3, yaw: 0, desk: false, occupant: null })),
          ...[-1.8, -0.6, 0.6, 1.8].map((dx) => ({ x: cx + dx, z: -0.5, yaw: Math.PI, desk: false, occupant: null })),
        ],
      };
    }
    return {
      ...base,
      id: def.id,
      name: def.name,
      kind: 'work' as const,
      def,
      floorColor: tint(def.color, 0.8),
      seats: deskSeats(slot.x0, slot.x1, [-2.6, 0.9]).slice(0, slot.x1 - slot.x0 > 7 ? 8 : 4),
    };
  });
  rooms.push({
    ...PANTRY,
    id: 'pantry',
    name: 'Pantry',
    kind: 'pantry',
    z0: -6,
    z1: ROOM_FRONT_Z,
    doorX: (PANTRY.x0 + PANTRY.x1) / 2,
    floorColor: 0xf3e5c6,
    seats: [
      ...[5.6, 6.6, 7.6].map((x) => ({ x, z: -3.9, yaw: 0, desk: false, occupant: null })),
      ...[5.2, 6.4].map((x) => ({ x, z: 1.2, yaw: Math.PI, desk: false, occupant: null })),
    ],
  });
  return rooms;
}

// ── Static geometry ─────────────────────────────────────────────────────────

const C = {
  grass: 0xa9c98f,
  grassDark: 0x94b97b,
  path: 0xddd5c7,
  wall: 0xf3eee6,
  wallShade: 0xe2dbd0,
  slab: 0xcfc6b8,
  corridor: 0xe9e3d9,
  fence: 0x3a3f4b,
  trunk: 0x8a6a4f,
  leaf: [0x6fae6f, 0x5d9f63, 0x82bb74],
  desk: 0xeed9bb,
  deskLeg: 0x9a8a78,
  monitor: 0x2a2f3c,
  screen: 0x8fd3ff,
  chair: 0x4a4f5e,
  sofa: 0xe58f8f,
  table: 0xd8bf98,
  counter: 0xffffff,
  plantPot: 0xd98f5f,
  glass: 0xbfe3f2,
  rail: 0x9aa4b2,
  board: 0xfafafa,
  shelf: 0xb98b62,
  books: [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x457b9d, 0x9b5de5],
  lamp: 0xfff2c4,
  orange: 0xf4a261,
  pcb: 0x2f9e5b,
  dark: 0x2b2f3a,
  metal: 0xb8c0cc,
  red: 0xd64545,
  yellow: 0xffcf33,
};

type Bucket = 'solid' | 'glass';

class GeometryBatch {
  private parts: Record<string, BufferGeometry[]> = {};

  add(key: string, geo: BufferGeometry, color: number): void {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const c = new Color(color);
    const n = g.getAttribute('position').count;
    const colors = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new Float32BufferAttribute(colors, 3));
    g.deleteAttribute('uv');
    (this.parts[key] ??= []).push(g);
  }

  box(key: string, x: number, y: number, z: number, w: number, h: number, d: number, color: number): void {
    this.add(key, new BoxGeometry(w, h, d).translate(x, y + h / 2, z), color);
  }

  cyl(key: string, x: number, y: number, z: number, r: number, h: number, color: number, seg = 12): void {
    this.add(key, new CylinderGeometry(r, r, h, seg).translate(x, y + h / 2, z), color);
  }

  build(key: string, material: MeshLambertMaterial): Mesh | null {
    const parts = this.parts[key];
    if (!parts?.length) return null;
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return new Mesh(merged, material);
  }
}

export interface BuiltScene {
  ground: Group;
  levels: [Group, Group];
  dispose(): void;
}

const solidMat = new MeshLambertMaterial({ vertexColors: true });
const glassMat = new MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.28, depthWrite: false });

export function buildScene(rooms: Room[]): BuiltScene {
  const b = new GeometryBatch();
  const key = (level: number | 'ground', bucket: Bucket) => `${level}:${bucket}`;

  // ── Lot: grass, path, fence, trees, lamps ────────────────────────────────
  const G = key('ground', 'solid');
  b.add(
    G,
    new PlaneGeometry(LOT.x1 - LOT.x0 + 30, LOT.z1 - LOT.z0 + 30)
      .rotateX(-Math.PI / 2)
      .translate(0, -0.02, (LOT.z0 + LOT.z1) / 2),
    C.grass,
  );
  for (const [x, z, w, d] of [
    [-18, 10, 9, 7],
    [18, 10, 9, 7],
    [-19, -10, 7, 6],
    [19, -10, 7, 6],
  ]) {
    b.box(G, x, -0.01, z, w, 0.02, d, C.grassDark);
  }
  b.box(G, 0, 0, 12, 3.2, 0.04, 12, C.path);
  b.box(G, 0, 0, 6.8, 26, 0.04, 1.6, C.path);

  const postH = 1.4;
  const fenceRun = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.max(1, Math.round(len / 2));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      b.box(G, x0 + (x1 - x0) * t, 0, z0 + (z1 - z0) * t, 0.22, postH, 0.22, C.fence);
    }
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0);
    for (const y of [0.45, 1.05]) {
      b.box(G, (x0 + x1) / 2, y, (z0 + z1) / 2, along ? len : 0.08, 0.08, along ? 0.08 : len, C.fence);
    }
  };
  fenceRun(LOT.x0, LOT.z0, LOT.x1, LOT.z0);
  fenceRun(LOT.x0, LOT.z0, LOT.x0, LOT.z1);
  fenceRun(LOT.x1, LOT.z0, LOT.x1, LOT.z1);
  fenceRun(LOT.x0, LOT.z1, -2.2, LOT.z1);
  fenceRun(2.2, LOT.z1, LOT.x1, LOT.z1);

  const tree = (x: number, z: number, s: number, i: number) => {
    b.add(G, new CylinderGeometry(0.16 * s, 0.22 * s, 1.6 * s, 6).translate(x, 0.8 * s, z), C.trunk);
    b.add(G, new IcosahedronGeometry(1.15 * s, 0).translate(x, 2.2 * s, z), C.leaf[i % 3]);
    b.add(G, new IcosahedronGeometry(0.8 * s, 0).translate(x + 0.5 * s, 2.9 * s, z - 0.2 * s), C.leaf[(i + 1) % 3]);
  };
  const trees: Array<[number, number, number]> = [
    [-20, 14, 1.2], [-15, 15, 0.9], [15, 15, 1], [20, 13, 1.3], [-21, 3, 1.1],
    [21, 4, 1], [-20, -8, 1.2], [20, -9, 1.1], [-14, -12.5, 0.9], [14, -12.5, 1],
    [-6, -12.8, 0.8], [7, -13, 0.9], [-5.5, 14.5, 0.8], [6, 14.8, 0.85],
  ];
  trees.forEach(([x, z, s], i) => tree(x, z, s, i));
  for (const x of [-4, 4]) {
    b.box(G, x, 0, 15, 0.12, 2.6, 0.12, C.fence);
    b.box(G, x, 2.6, 15, 0.4, 0.25, 0.4, C.lamp);
  }

  // ── Storeys ──────────────────────────────────────────────────────────────
  for (const level of [0, 1] as const) {
    const S = key(level, 'solid');
    const Gl = key(level, 'glass');
    const y0 = level * FLOOR_H;
    const fy = y0 + SLAB;
    const wallH = FLOOR_H - SLAB;
    const W = BUILDING.x1 - BUILDING.x0;

    b.box(S, 0, y0, 0, W, SLAB, BUILDING.z1 - BUILDING.z0, C.slab);
    b.box(S, 0, fy, (ROOM_FRONT_Z + BUILDING.z1) / 2, W - 0.2, 0.02, BUILDING.z1 - ROOM_FRONT_Z, C.corridor);
    b.box(S, 0, fy, BUILDING.z0 + 0.1, W, wallH, 0.2, C.wall);
    b.box(S, BUILDING.x0 + 0.1, fy, 0, 0.2, wallH, BUILDING.z1 - BUILDING.z0, C.wallShade);
    b.box(S, BUILDING.x1 - 0.1, fy, 0, 0.2, wallH, BUILDING.z1 - BUILDING.z0, C.wallShade);
    b.box(Gl, 0, fy + 1.1, BUILDING.z0 + 0.22, W - 1, 1.2, 0.04, C.glass);

    if (level === 1) {
      b.box(Gl, 0, fy, BUILDING.z1 - 0.05, W, 1.0, 0.06, C.glass);
      b.box(S, 0, fy + 1.0, BUILDING.z1 - 0.05, W, 0.06, 0.1, C.rail);
      b.box(S, 0, fy + wallH, BUILDING.z0 + 0.1, W + 0.2, 0.25, 0.35, C.wallShade);
    } else {
      b.box(S, 0, FLOOR_H - 0.1, BUILDING.z1 + 0.8, 5, 0.12, 1.8, C.wallShade);
    }
    b.box(Gl, ELEVATOR.x, fy, ELEVATOR.z, 1.6, wallH, 2.4, C.glass);
    b.box(S, ELEVATOR.x, fy + wallH - 0.15, ELEVATOR.z, 1.7, 0.15, 2.5, C.rail);

    for (const r of rooms.filter((x) => x.level === level)) {
      const w = r.x1 - r.x0;
      const d = r.z1 - r.z0;
      const cx = (r.x0 + r.x1) / 2;
      const cz = (r.z0 + r.z1) / 2;
      b.box(S, cx, fy, cz, w - 0.25, 0.025, d - 0.25, r.floorColor);
      b.box(S, r.x1, fy, cz, 0.14, wallH * 0.92, d, C.wall);
      const gap = 1.5;
      const leftW = r.doorX - gap / 2 - r.x0;
      const rightW = r.x1 - (r.doorX + gap / 2);
      if (leftW > 0.1) b.box(Gl, r.x0 + leftW / 2, fy, ROOM_FRONT_Z, leftW, 2.4, 0.05, C.glass);
      if (rightW > 0.1) b.box(Gl, r.x1 - rightW / 2, fy, ROOM_FRONT_Z, rightW, 2.4, 0.05, C.glass);
      b.box(S, cx, fy + 2.4, ROOM_FRONT_Z, w, 0.12, 0.1, C.rail);
      // A stripe of the room's colour above the door.
      if (r.def) b.box(S, cx, fy + 2.52, ROOM_FRONT_Z, w, 0.08, 0.11, new Color(r.def.color).getHex());
      furnishRoom(b, S, r, fy);
    }
  }

  const ground = new Group();
  const groundMesh = b.build(G, solidMat);
  if (groundMesh) {
    groundMesh.receiveShadow = true;
    groundMesh.castShadow = true;
    ground.add(groundMesh);
  }
  const levels: [Group, Group] = [new Group(), new Group()];
  for (const level of [0, 1] as const) {
    const s = b.build(key(level, 'solid'), solidMat);
    const g = b.build(key(level, 'glass'), glassMat);
    if (s) {
      s.castShadow = true;
      s.receiveShadow = true;
      levels[level].add(s);
    }
    if (g) {
      g.renderOrder = 1;
      levels[level].add(g);
    }
  }
  return {
    ground,
    levels,
    dispose() {
      for (const grp of [ground, ...levels]) {
        grp.traverse((o) => {
          const m = o as Mesh;
          if (m.isMesh) m.geometry.dispose();
        });
        grp.removeFromParent();
      }
    },
  };
}

function furnishRoom(b: GeometryBatch, S: string, r: Room, fy: number): void {
  const cx = (r.x0 + r.x1) / 2;
  const plant = (x: number, z: number) => {
    b.box(S, x, fy, z, 0.42, 0.42, 0.42, C.plantPot);
    b.add(S, new IcosahedronGeometry(0.4, 0).translate(x, fy + 0.8, z), C.leaf[0]);
  };
  const shelf = (x: number, z: number, w = 1.6) => {
    b.box(S, x, fy, z, w, 1.9, 0.4, C.shelf);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 6; i++) {
        b.box(S, x - w / 2 + 0.2 + i * (w - 0.3) / 6, fy + 0.25 + row * 0.6, z + 0.12, 0.14, 0.38, 0.2, C.books[(i + row) % 5]);
      }
    }
  };

  if (r.kind === 'work') {
    for (const seat of r.seats) {
      const dz = seat.z + 0.7;
      b.box(S, seat.x, fy + DESK_H - 0.05, dz, 1.4, 0.05, 0.7, C.desk);
      for (const sx of [-0.63, 0.63]) b.box(S, seat.x + sx, fy, dz, 0.06, DESK_H - 0.05, 0.62, C.deskLeg);
      // Monitor off to one side so the agent's face stays visible.
      b.box(S, seat.x + 0.42, fy + DESK_H, dz - 0.05, 0.08, 0.14, 0.08, C.monitor);
      b.box(S, seat.x + 0.42, fy + DESK_H + 0.12, dz - 0.05, 0.5, 0.32, 0.04, C.monitor);
      b.box(S, seat.x + 0.42, fy + DESK_H + 0.15, dz - 0.075, 0.44, 0.26, 0.01, C.screen);
      b.box(S, seat.x - 0.1, fy + DESK_H, dz + 0.05, 0.42, 0.025, 0.14, C.dark); // keyboard
      // Chair.
      b.box(S, seat.x, fy + SEAT_H - 0.06, seat.z - 0.05, 0.48, 0.06, 0.46, C.chair);
      b.box(S, seat.x, fy + SEAT_H, seat.z - 0.28, 0.48, 0.5, 0.07, C.chair);
      b.box(S, seat.x, fy, seat.z - 0.05, 0.08, SEAT_H - 0.06, 0.08, C.chair);
      if (r.def) deskProp(b, S, r.def.theme, seat.x - 0.45, fy + DESK_H, dz - 0.1);
    }
    b.box(S, cx, fy + 1.1, r.z0 + 0.25, Math.min(3, r.x1 - r.x0 - 3), 1.0, 0.06, C.board);
    if (r.def) roomProp(b, S, r.def.theme, r, fy, shelf);
    plant(r.x1 - 0.6, r.z1 - 0.7);
  } else if (r.kind === 'meeting') {
    b.box(S, cx, fy + DESK_H - 0.06, -1.9, 5, 0.06, 1.8, C.table);
    for (const x of [cx - 2.2, cx + 2.2]) b.box(S, x, fy, -1.9, 0.12, DESK_H - 0.06, 1.2, C.deskLeg);
    for (const seat of r.seats) {
      b.box(S, seat.x, fy + SEAT_H - 0.06, seat.z, 0.48, 0.06, 0.46, C.chair);
      const back = seat.yaw === 0 ? -0.24 : 0.24;
      b.box(S, seat.x, fy + SEAT_H, seat.z + back, 0.48, 0.45, 0.07, C.chair);
    }
    b.box(S, cx, fy + 1.0, r.z0 + 0.25, 4, 1.4, 0.06, C.board);
    plant(r.x0 + 0.6, r.z1 - 0.7);
  } else {
    b.box(S, cx, fy, r.z0 + 0.5, r.x1 - r.x0 - 0.6, 0.9, 0.8, C.counter);
    b.box(S, cx, fy + 0.9, r.z0 + 0.5, r.x1 - r.x0 - 0.6, 0.05, 0.85, C.table);
    b.box(S, r.x1 - 1, fy + 0.95, r.z0 + 0.5, 0.35, 0.4, 0.3, C.dark); // coffee machine
    for (const seat of r.seats.filter((s) => s.yaw === 0)) b.cyl(S, seat.x, fy, seat.z, 0.2, SEAT_H, C.chair);
    b.box(S, 5.8, fy, 1.3, 2.6, 0.4, 0.9, C.sofa);
    b.box(S, 5.8, fy + 0.4, 1.7, 2.6, 0.45, 0.2, C.sofa);
    b.box(S, 5.8, fy, -0.3, 1.4, 0.36, 0.7, C.table);
    plant(r.x1 - 0.6, r.z1 - 0.7);
  }
}

/** Small item on each desk, by theme. */
function deskProp(b: GeometryBatch, S: string, theme: Theme, x: number, y: number, z: number): void {
  switch (theme) {
    case 'pcb':
    case 'hardware':
      b.box(S, x, y, z, 0.3, 0.02, 0.22, C.pcb);
      b.box(S, x + 0.05, y + 0.02, z, 0.06, 0.04, 0.06, C.dark);
      break;
    case 'firmware':
      b.box(S, x, y, z, 0.22, 0.02, 0.14, 0x1f6fb2);
      break;
    case 'robot':
    case 'sim':
      b.box(S, x, y, z, 0.2, 0.12, 0.16, C.orange);
      b.add(S, new SphereGeometry(0.05, 10, 8).translate(x, y + 0.18, z), C.orange);
      break;
    case 'writing':
    case 'report':
    case 'research':
      b.box(S, x, y, z, 0.22, 0.06, 0.3, C.books[1]);
      break;
    case 'audio':
      b.box(S, x, y, z, 0.12, 0.22, 0.12, C.dark);
      break;
    default:
      b.cyl(S, x, y, z, 0.05, 0.1, 0xffffff);
  }
}

/** One bigger set piece per room, by theme. */
function roomProp(b: GeometryBatch, S: string, theme: Theme, r: Room, fy: number, shelf: (x: number, z: number, w?: number) => void): void {
  const x = r.x0 + 0.9;
  const z = r.z0 + 0.8;
  switch (theme) {
    case 'robot': {
      // Robot arm on a pedestal.
      b.cyl(S, x, fy, z, 0.3, 0.5, C.dark);
      b.cyl(S, x, fy + 0.5, z, 0.18, 0.2, C.orange);
      b.box(S, x, fy + 0.7, z, 0.14, 0.7, 0.14, C.orange);
      b.box(S, x + 0.25, fy + 1.35, z, 0.6, 0.12, 0.12, C.orange);
      b.box(S, x + 0.55, fy + 1.15, z, 0.08, 0.25, 0.08, C.metal);
      break;
    }
    case 'sim': {
      b.box(S, (r.x0 + r.x1) / 2 + 2.2, fy + 1.0, r.z0 + 0.3, 2, 1.2, 0.06, C.dark);
      b.box(S, (r.x0 + r.x1) / 2 + 2.2, fy + 1.05, r.z0 + 0.34, 1.85, 1.05, 0.01, 0x3d7bd9);
      // A little mobile robot on the floor.
      b.box(S, x, fy + 0.12, z + 1.2, 0.6, 0.25, 0.45, C.orange);
      for (const [dx, dz] of [[-0.25, -0.2], [0.25, -0.2], [-0.25, 0.2], [0.25, 0.2]]) {
        b.add(S, new CylinderGeometry(0.1, 0.1, 0.06, 12).rotateZ(Math.PI / 2).translate(x + dx, fy + 0.1, z + 1.2 + dz), C.dark);
      }
      break;
    }
    case 'hardware':
    case 'pcb':
    case 'firmware': {
      // Workbench with an oscilloscope and a red toolbox.
      b.box(S, x + 0.3, fy, z, 1.6, 0.85, 0.7, C.shelf);
      b.box(S, x, fy + 0.85, z, 0.5, 0.32, 0.35, C.metal);
      b.box(S, x, fy + 0.9, z + 0.18, 0.32, 0.2, 0.01, 0x3fd18b);
      b.box(S, x + 0.75, fy + 0.85, z, 0.45, 0.22, 0.25, C.red);
      break;
    }
    case 'video':
    case 'design': {
      // Camera on a tripod and a softbox.
      for (const a of [0, 2.1, 4.2]) {
        b.add(S, new CylinderGeometry(0.02, 0.02, 1.3, 6).rotateZ(0.25).rotateY(a).translate(x, fy + 0.62, z + 0.8), C.dark);
      }
      b.box(S, x, fy + 1.25, z + 0.8, 0.35, 0.22, 0.25, C.dark);
      b.cyl(S, x, fy + 1.3, z + 0.98, 0.08, 0.08, C.metal);
      b.box(S, x + 1.4, fy + 1.2, z, 0.7, 0.7, 0.3, 0xffffff);
      b.box(S, x + 1.4, fy, z, 0.05, 1.2, 0.05, C.dark);
      break;
    }
    case 'audio': {
      for (const dx of [0, 1.6]) {
        b.box(S, x + dx, fy, z, 0.45, 1.0, 0.4, C.dark);
        b.cyl(S, x + dx, fy + 0.55, z + 0.2, 0.14, 0.02, C.metal);
      }
      break;
    }
    case 'system': {
      // Server rack with status lights.
      b.box(S, x, fy, z, 0.7, 1.9, 0.6, C.dark);
      for (let i = 0; i < 6; i++) b.box(S, x - 0.2, fy + 0.3 + i * 0.27, z + 0.31, 0.06, 0.04, 0.01, i % 2 ? 0x3fd18b : 0x5fa8ff);
      break;
    }
    case 'files':
      for (let i = 0; i < 3; i++) b.box(S, x + i * 0.6, fy, z, 0.55, 1.3, 0.55, C.metal);
      break;
    case 'research':
    case 'writing':
    case 'report':
    case 'review':
    case 'lead':
      shelf(x + 0.4, z - 0.4);
      if (theme === 'research') b.add(S, new SphereGeometry(0.22, 14, 10).translate(x + 1.6, fy + 0.95, z), 0x3d8bd9);
      break;
    default:
      shelf(x + 0.4, z - 0.4, 1.2);
  }
}
