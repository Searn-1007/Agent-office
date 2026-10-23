/**
 * The 3D office: renderer, camera, the static building and one chibi figure
 * per agent (plus temporary figures for sub-agents).
 *
 * Rooms come from the current setup. Agents sit at a desk in their room while they work; once a turn is
 * done they wander to the pantry for a break and walk back when work resumes.
 * Routes go room → corridor → (elevator) → corridor → room, so nobody walks
 * through walls.
 */

import {
  Color,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Raycaster,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import type { BuiltScene, Room, Seat } from './building';
import { BUILDING, buildRooms, buildScene, CORRIDOR_Z, ELEVATOR, levelY, ROOM_FRONT_Z } from './building';
import type { FigureLook, Pose } from './figures';
import { ChibiFigure } from './figures';
import type { Setup } from './setup';
import type { AgentInfo, SubagentInfo } from './types';
import { STATUS_META, UNKNOWN_ROOM_COLOR } from './types';

/** Seconds a finished agent lingers at its desk before taking a break. */
const BREAK_AFTER_SEC = 12;
const MAX_PIXEL_RATIO = 1;
/** Frame caps: smooth while the camera moves, half rate when only the
 *  figures animate (a 144 Hz screen would otherwise draw 144 times a second). */
const ACTIVE_FPS = 60;
const IDLE_FPS = 30;
/** Seconds after the last camera movement before dropping to IDLE_FPS. */
const ACTIVE_HOLD_SEC = 1.5;
/** GPU-bound frames longer than this (ms, averaged) step quality down. */
const SLOW_FRAME_MS = 26;

export type ViewId = 'overview' | 'level0' | 'level1' | 'yard' | `room:${string}`;

interface Place {
  room: Room;
  seat: Seat | null;
  /** Standing spot when every seat is taken. */
  x: number;
  z: number;
}

interface Actor {
  key: string;
  figure: ChibiFigure;
  place: Place | null;
  /** Where the actor is heading (null once arrived). */
  heading: Place | null;
  pose: Pose;
  agent?: AgentInfo;
  doneFor: number;
  /** Offset from the corridor's center line, so walkers don't overlap. */
  lane: number;
}

interface CameraShot {
  pos: Vector3;
  target: Vector3;
}

export class Office {
  private readonly renderer: WebGLRenderer;
  private readonly labels = new CSS2DRenderer();
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(38, 1, 0.5, 400);
  private readonly controls: OrbitControls;
  private readonly sun = new DirectionalLight(0xffffff, 2.2);
  /** Containers for each storey; their content is rebuilt when the setup changes. */
  private readonly levels: [Group, Group] = [new Group(), new Group()];
  private readonly groundGroup = new Group();
  private built: BuiltScene | null = null;
  private rooms: Room[] = [];
  private signs: CSS2DObject[] = [];
  private readonly actors = new Map<string, Actor>();
  private readonly raycaster = new Raycaster();
  private shot: { from: CameraShot; to: CameraShot; t: number } | null = null;
  private last = performance.now();
  private lastDraw = 0;
  private activeUntil = 0;
  /** Smoothed time between drawn frames, for the adaptive quality check. */
  private frameMs = 16;
  private slowFor = 0;
  private quality = 2;
  fps = 0;
  private view: ViewId = 'overview';
  /** Actor the camera trails until the user drags or picks a view. */
  private follow: string | null = null;
  onPick: (agentId: number) => void = () => {};

  constructor(host: HTMLElement, labelHost: HTMLElement) {
    this.renderer = new WebGLRenderer({
      antialias: (window.devicePixelRatio || 1) < 1.5,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
    this.renderer.shadowMap.enabled = true;
    // The building never moves: render its shadows once, not every frame.
    this.renderer.shadowMap.autoUpdate = false;
    host.appendChild(this.renderer.domElement);
    this.labels.domElement.className = 'label-layer';
    labelHost.appendChild(this.labels.domElement);

    this.scene.background = new Color(0xdfe6ee);
    this.scene.fog = new Fog(0xdfe6ee, 70, 160);
    this.scene.add(new HemisphereLight(0xffffff, 0x8fa08a, 1.4));
    this.sun.position.set(-18, 30, 22);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -32;
    sc.right = 32;
    sc.top = 28;
    sc.bottom = -28;
    sc.far = 90;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun);

    this.scene.add(this.groundGroup, ...this.levels);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 80;
    this.controls.maxPolarAngle = 1.38;
    this.controls.screenSpacePanning = true;
    this.controls.addEventListener('start', () => {
      this.shot = null;
      this.follow = null;
    });
    this.controls.addEventListener('change', () => this.wake());
    const first = this.shotFor('overview');
    this.camera.position.copy(first.pos);
    this.controls.target.copy(first.target);

    this.renderer.domElement.addEventListener('click', (e) => this.pick(e));
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.shadowMap.needsUpdate = true;
    requestAnimationFrame(() => this.frame());
    if (new URLSearchParams(location.search).has('debug')) {
      (window as unknown as Record<string, unknown>).__office = this;
    }
  }

  // ── Views ───────────────────────────────────────────────────────────────

  setView(view: ViewId): void {
    this.view = view;
    this.follow = null;
    const showUpper = !(view === 'level0' || (view.startsWith('room:') && this.room(view.slice(5))?.level === 0));
    this.setUpperVisible(showUpper);
    this.wake();
    this.flyTo(this.shotFor(view));
  }

  private shotFor(view: ViewId): CameraShot {
    const v = (x: number, y: number, z: number) => new Vector3(x, y, z);
    if (view === 'level0') return { pos: v(-3, 17, 25), target: v(-3.5, 0.5, 0) };
    if (view === 'level1') return { pos: v(-3, 20, 25), target: v(-3.5, 3.9, 0) };
    if (view === 'yard') return { pos: v(-30, 14, 34), target: v(0, 1, 4) };
    const r = view.startsWith('room:') ? this.room(view.slice(5)) : undefined;
    if (r) {
      const cx = (r.x0 + r.x1) / 2;
      const y = levelY(r.level);
      return { pos: v(cx - 1, y + 8, 13), target: v(cx - 1.8, y + 0.6, -1.5) };
    }
    return { pos: v(-9, 12, 36), target: v(-4, 2.8, 0) };
  }

  private flyTo(to: CameraShot): void {
    this.shot = {
      from: { pos: this.camera.position.clone(), target: this.controls.target.clone() },
      to,
      t: 0,
    };
  }

  focusAgent(id: number): void {
    const a = this.actors.get(`a${id}`);
    if (!a?.agent) return;
    // Upper storey off when the agent works downstairs, so it isn't hidden.
    const level = this.workRoom(a.agent.roomId)?.level ?? 0;
    this.setUpperVisible(level === 1);
    this.follow = a.key;
    this.shot = null;
  }

  private setUpperVisible(visible: boolean): void {
    if (this.levels[1].visible === visible) return;
    this.levels[1].visible = visible;
    for (const x of this.actors.values()) this.applyVisibility(x);
    this.renderer.shadowMap.needsUpdate = true;
  }

  /** Ease the camera toward a point a few meters in front of the followed actor. */
  private trail(dt: number): void {
    const a = this.follow ? this.actors.get(this.follow) : undefined;
    if (!a) {
      this.follow = null;
      return;
    }
    const p = a.figure.position;
    const target = new Vector3(p.x - 1.5, p.y + 1, p.z);
    const pos = new Vector3(p.x - 0.5, p.y + 7.5, p.z + 12.5);
    const k = 1 - Math.pow(0.02, dt);
    this.controls.target.lerp(target, k);
    this.camera.position.lerp(pos, k);
  }

  // ── Setup ───────────────────────────────────────────────────────────────

  /** Rebuild the rooms for a new setup and send everyone to their new desk. */
  setSetup(setup: Setup): void {
    this.rooms = buildRooms(setup);
    this.built?.dispose();
    for (const sign of this.signs) {
      sign.element.remove();
      sign.removeFromParent();
    }
    this.signs = [];
    this.built = buildScene(this.rooms);
    this.groundGroup.add(this.built.ground);
    this.levels[0].add(this.built.levels[0]);
    this.levels[1].add(this.built.levels[1]);
    this.addRoomSigns();
    this.renderer.shadowMap.needsUpdate = true;
    for (const a of this.actors.values()) {
      // Old seats are gone; step out to the corridor and re-route from there.
      a.place = null;
      a.heading = null;
      a.figure.walk([]);
      a.figure.position.z = CORRIDOR_Z + a.lane;
      if (!a.agent) a.figure.vanish();
    }
    this.wake();
  }

  private room(id: string): Room | undefined {
    return this.rooms.find((r) => r.id === id);
  }

  /** The room an agent works in; agents whose room left the setup use the first one. */
  private workRoom(roomId: string): Room | undefined {
    return this.room(roomId) ?? this.rooms.find((r) => r.kind === 'work');
  }

  // ── Agents ──────────────────────────────────────────────────────────────

  syncAgents(agents: AgentInfo[]): void {
    const live = new Set<string>();
    for (const agent of agents) {
      const key = `a${agent.id}`;
      live.add(key);
      let actor = this.actors.get(key);
      if (!actor) {
        const def = this.workRoom(agent.roomId)?.def;
        actor = this.spawn(key, {
          color: def?.color ?? UNKNOWN_ROOM_COLOR,
          seed: agent.id * 7.31 + hash(agent.name),
          theme: def?.theme ?? 'code',
          coordinator: def?.coordinator ?? false,
        });
      }
      actor.agent = agent;
      this.updateLabel(actor);
      this.syncSubagents(agent, live);
    }
    for (const [key, actor] of this.actors) {
      if (!live.has(key)) this.retire(actor);
    }
  }

  private syncSubagents(agent: AgentInfo, live: Set<string>): void {
    for (const sub of agent.subagents) {
      const key = `s${agent.id}:${sub.id}`;
      live.add(key);
      let actor = this.actors.get(key);
      if (!actor) {
        const room = this.workRoom(sub.roomId) ?? this.workRoom(agent.roomId);
        if (!room) continue;
        actor = this.spawn(
          key,
          {
            color: room.def?.color ?? UNKNOWN_ROOM_COLOR,
            seed: hash(sub.id),
            theme: room.def?.theme ?? 'code',
            coordinator: false,
            scale: 0.8,
          },
          this.actors.get(`a${agent.id}`),
        );
        actor.figure.speed = 1.6;
        this.sendTo(actor, this.freePlace(room, key, true), 'type');
      }
      this.updateSubLabel(actor, sub);
    }
  }

  private spawn(key: string, look: FigureLook, near?: Actor): Actor {
    const figure = new ChibiFigure(look);
    const room = (near ? (near.heading?.room ?? near.place?.room) : undefined) ?? this.rooms[0];
    const start = near
      ? near.figure.position.clone().add(new Vector3(0.6, 0, 0.6))
      : new Vector3((Math.random() - 0.5) * 1.5, levelY(0), BUILDING.z1 + 1.2);
    figure.position.copy(start);
    this.scene.add(figure.root);
    figure.labelEl.addEventListener('click', () => {
      const id = Number(key.slice(1).split(':')[0]);
      if (!Number.isNaN(id)) this.onPick(id);
    });
    // New agents arrive from the corridor; sub-agents step out of their lead's room.
    const place = near ? { room, seat: null, x: start.x, z: start.z } : null;
    const actor: Actor = { key, figure, place, heading: null, pose: 'stand', doneFor: 0, lane: (Math.random() - 0.5) * 1.1 };
    this.actors.set(key, actor);
    this.applyVisibility(actor);
    return actor;
  }

  private retire(actor: Actor): void {
    if (actor.place?.seat) actor.place.seat.occupant = null;
    if (actor.heading?.seat) actor.heading.seat.occupant = null;
    actor.figure.vanish();
  }

  /** What an agent should be doing right now, given its status. */
  private desiredPlace(actor: Actor, dt: number): { room: Room; pose: Pose } | null {
    const agent = actor.agent;
    if (!agent) return null;
    if (agent.status === 'done' || agent.status === 'idle') actor.doneFor += dt;
    else actor.doneFor = 0;
    const work = this.workRoom(agent.roomId);
    if (!work) return null;
    if (agent.status === 'exited') return { room: work, pose: 'stand' };
    if (agent.status === 'approval') return { room: work, pose: 'wave' };
    if (agent.status === 'working' || agent.status === 'starting') return { room: work, pose: 'type' };
    const pantry = this.room('pantry');
    if (actor.doneFor > BREAK_AFTER_SEC && pantry) return { room: pantry, pose: 'sit' };
    return { room: work, pose: 'sit' };
  }

  private freePlace(room: Room, key: string, desk: boolean): Place {
    const seat =
      room.seats.find((s) => s.occupant === key) ??
      room.seats.find((s) => s.occupant === null && (!desk || s.desk)) ??
      room.seats.find((s) => s.occupant === null);
    if (seat) {
      seat.occupant = key;
      return { room, seat, x: seat.x, z: seat.z };
    }
    // Full room: stand somewhere along the front.
    const x = room.x0 + 1 + Math.random() * (room.x1 - room.x0 - 2);
    return { room, seat: null, x, z: ROOM_FRONT_Z - 0.8 };
  }

  private sendTo(actor: Actor, place: Place, pose: Pose): void {
    if (actor.place?.seat && actor.place.seat !== place.seat) actor.place.seat.occupant = null;
    actor.heading = place;
    actor.pose = 'stand';
    actor.figure.pose = 'stand';
    const route = this.route(actor.figure.position, actor.place, place, CORRIDOR_Z + actor.lane);
    actor.figure.walk(route, () => {
      actor.place = place;
      actor.heading = null;
      actor.pose = pose;
      actor.figure.pose = place.seat ? pose : pose === 'type' ? 'stand' : pose;
      actor.figure.face(place.seat?.yaw ?? 0);
      this.applyVisibility(actor);
    });
  }

  /** Waypoints from the current spot to `to`, via doors, corridor and lift. */
  private route(from: Vector3, fromPlace: Place | null, to: Place, corridorZ: number): Vector3[] {
    const pts: Vector3[] = [];
    const fromRoom = fromPlace?.room;
    const toY = levelY(to.room.level);
    const aisle = (p: Place) => (p.seat?.desk ? p.x + 1.15 : p.x);

    const sameFloor = Math.abs(from.y - levelY(to.room.level)) < 0.5;
    if (fromRoom && fromRoom === to.room && sameFloor) {
      if (fromPlace?.seat?.desk) pts.push(new Vector3(aisle(fromPlace), toY, from.z));
      if (to.seat?.desk) pts.push(new Vector3(aisle(to), toY, ROOM_FRONT_Z - 0.6), new Vector3(aisle(to), toY, to.z));
      pts.push(new Vector3(to.x, toY, to.z));
      return pts;
    }

    const fromY = from.y;
    if (fromRoom && from.z < ROOM_FRONT_Z) {
      if (fromPlace?.seat?.desk) pts.push(new Vector3(aisle(fromPlace), fromY, from.z));
      pts.push(new Vector3(fromPlace?.seat?.desk ? aisle(fromPlace) : from.x, fromY, ROOM_FRONT_Z - 0.6));
      pts.push(new Vector3(fromRoom.doorX, fromY, ROOM_FRONT_Z - 0.6));
      pts.push(new Vector3(fromRoom.doorX, fromY, corridorZ));
    } else {
      pts.push(new Vector3(from.x, fromY, corridorZ));
    }

    const fromLevel = Math.round((fromY - levelY(0)) / (levelY(1) - levelY(0)));
    if (fromLevel !== to.room.level) {
      pts.push(new Vector3(ELEVATOR.x, fromY, corridorZ));
      pts.push(new Vector3(ELEVATOR.x, fromY, ELEVATOR.z));
      pts.push(new Vector3(ELEVATOR.x, toY, ELEVATOR.z));
      pts.push(new Vector3(ELEVATOR.x, toY, corridorZ));
    }

    pts.push(new Vector3(to.room.doorX, toY, corridorZ));
    pts.push(new Vector3(to.room.doorX, toY, ROOM_FRONT_Z - 0.6));
    if (to.seat?.desk) {
      pts.push(new Vector3(aisle(to), toY, ROOM_FRONT_Z - 0.6));
      pts.push(new Vector3(aisle(to), toY, to.z));
    }
    pts.push(new Vector3(to.x, toY, to.z));
    return pts;
  }

  private tickActor(actor: Actor, dt: number): void {
    if (actor.key.startsWith('a')) {
      const want = this.desiredPlace(actor, dt);
      if (want) {
        const current = actor.heading ?? actor.place;
        const wantDesk = want.room.kind === 'work';
        if (!current || current.room !== want.room) {
          this.sendTo(actor, this.freePlace(want.room, actor.key, wantDesk), want.pose);
        } else if (!actor.heading && actor.pose !== want.pose) {
          actor.pose = want.pose;
          actor.figure.pose = current.seat ? want.pose : want.pose === 'type' ? 'stand' : want.pose;
          actor.figure.face(current.seat?.yaw ?? 0);
        }
      }
    }
    actor.figure.update(dt);
    if (actor.figure.walking) this.applyVisibility(actor);
    if (actor.figure.gone) {
      actor.figure.dispose();
      this.actors.delete(actor.key);
    }
  }

  private applyVisibility(actor: Actor): void {
    const upper = actor.figure.position.y > levelY(1) - 0.5;
    const visible = !upper || this.levels[1].visible;
    actor.figure.root.visible = visible;
    actor.figure.label.visible = visible;
  }

  private updateLabel(actor: Actor): void {
    const a = actor.agent;
    if (!a) return;
    const sig = `${a.name}|${a.status}|${a.activity}`;
    if (actor.figure.labelEl.dataset.sig === sig) return;
    actor.figure.labelEl.dataset.sig = sig;
    const st = STATUS_META[a.status];
    const roomColor = this.workRoom(a.roomId)?.def?.color ?? UNKNOWN_ROOM_COLOR;
    actor.figure.labelEl.innerHTML = '';
    const el = actor.figure.labelEl;
    el.dataset.status = a.status;
    const name = document.createElement('div');
    name.className = 'fig-name';
    name.style.setProperty('--role', roomColor);
    name.textContent = `${a.name}`;
    const act = document.createElement('div');
    act.className = 'fig-activity';
    act.style.setProperty('--status', st.css);
    act.textContent = a.activity || st.label;
    el.append(name, act);
    if (a.status === 'approval') {
      const bang = document.createElement('div');
      bang.className = 'fig-alert';
      bang.textContent = '!';
      el.prepend(bang);
    }
  }

  private updateSubLabel(actor: Actor, sub: SubagentInfo): void {
    const el = actor.figure.labelEl;
    if (el.dataset.sub === sub.label) return;
    el.dataset.sub = sub.label;
    el.classList.add('fig-label-sub');
    el.innerHTML = '';
    const act = document.createElement('div');
    act.className = 'fig-activity';
    act.style.setProperty('--status', this.workRoom(sub.roomId)?.def?.color ?? UNKNOWN_ROOM_COLOR);
    act.textContent = sub.label.length > 34 ? `${sub.label.slice(0, 33)}…` : sub.label;
    el.append(act);
  }

  private addRoomSigns(): void {
    for (const r of this.rooms) {
      const el = document.createElement('div');
      el.className = 'room-sign';
      el.textContent = r.name;
      if (r.def) el.style.setProperty('--role', r.def.color);
      el.addEventListener('click', () => this.setView(`room:${r.id}`));
      const sign = new CSS2DObject(el);
      sign.position.set(r.doorX, levelY(r.level) + 3.0, ROOM_FRONT_Z + 0.05);
      this.levels[r.level].add(sign);
      this.signs.push(sign);
    }
  }

  // ── Picking, sizing, loop ───────────────────────────────────────────────

  private pick(e: MouseEvent): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    let best: { id: number; d: number } | null = null;
    for (const a of this.actors.values()) {
      if (!a.agent || !a.figure.root.visible) continue;
      const hits = this.raycaster.intersectObject(a.figure.root, true);
      if (hits.length && (!best || hits[0].distance < best.d)) best = { id: a.agent.id, d: hits[0].distance };
    }
    if (best) this.onPick(best.id);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Keep the full frame rate for a moment (camera moved, view changed). */
  wake(): void {
    this.activeUntil = performance.now() + ACTIVE_HOLD_SEC * 1000;
  }

  private frame(): void {
    requestAnimationFrame(() => this.frame());
    if (document.hidden) return;
    const now = performance.now();
    const moving = this.shot !== null || this.follow !== null || now < this.activeUntil;
    const interval = 1000 / (moving ? ACTIVE_FPS : IDLE_FPS);
    // Small slack so a 60 Hz display still hits 60 fps.
    if (now - this.lastDraw < interval - 2) return;
    const gap = now - this.lastDraw;
    this.lastDraw = now;
    const dt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;

    if (this.shot) {
      this.shot.t = Math.min(1, this.shot.t + dt / 0.9);
      const k = 1 - Math.pow(1 - this.shot.t, 3);
      this.camera.position.lerpVectors(this.shot.from.pos, this.shot.to.pos, k);
      this.controls.target.lerpVectors(this.shot.from.target, this.shot.to.target, k);
      if (this.shot.t >= 1) this.shot = null;
    } else if (this.follow) {
      this.trail(dt);
    }
    this.controls.update();
    for (const a of [...this.actors.values()]) this.tickActor(a, dt);
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
    this.adapt(gap, interval, dt);
  }

  /** Step quality down when frames come in much slower than asked for:
   *  first the shadows, then the render resolution. */
  private adapt(gap: number, interval: number, dt: number): void {
    if (gap > 250) return; // tab was in the background
    this.frameMs += (gap - this.frameMs) * 0.1;
    this.fps = Math.round(1000 / this.frameMs);
    const slow = this.frameMs > Math.max(SLOW_FRAME_MS, interval * 1.6);
    this.slowFor = slow ? this.slowFor + dt : 0;
    if (this.slowFor < 2 || this.quality === 0) return;
    this.slowFor = 0;
    this.quality--;
    if (this.quality === 1) {
      this.renderer.shadowMap.enabled = false;
      this.scene.traverse((o) => {
        const m = (o as unknown as { material?: { needsUpdate: boolean } }).material;
        if (m) m.needsUpdate = true;
      });
    } else {
      this.renderer.setPixelRatio(0.75);
      this.resize();
    }
    console.info(`[Agent Office] quality lowered to ${this.quality}`);
  }

  get currentView(): ViewId {
    return this.view;
  }
}

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h % 9973);
}
