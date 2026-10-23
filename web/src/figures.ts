/**
 * Chibi people: a big round head with eyes, blush and a smile, a bean body
 * and stubby limbs, toon-shaded. Hair style, hair colour and skin tone come
 * from a seed so every agent looks different; an accessory comes from the
 * room's theme. Everything is a handful of shared primitive geometries.
 */

import type { BufferGeometry, Material } from 'three';
import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DataTexture,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshToonMaterial,
  NearestFilter,
  RedFormat,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

import type { Theme } from './setup';

export type Pose = 'stand' | 'sit' | 'type' | 'wave';

const WALK_SPEED = 1.6;
const LIFT_SPEED = 1.3;
const TURN_RATE = 10;
const BODY_SCALE = 1.15;
/** Hip height (model units) and where the hips should be when seated (m). */
const HIP_Y = 0.42;
const SEAT_HIP_Y = 0.44;

// ── Shared geometry and materials ───────────────────────────────────────────

const geo = {
  head: new SphereGeometry(0.33, 24, 18),
  hairCap: new SphereGeometry(0.35, 24, 14, 0, Math.PI * 2, 0, 1.75),
  hairBall: new SphereGeometry(0.12, 14, 10),
  hairLong: new CapsuleGeometry(0.2, 0.22, 4, 12),
  torso: new CapsuleGeometry(0.19, 0.14, 6, 16),
  upperLeg: new CapsuleGeometry(0.075, 0.1, 4, 10),
  lowerLeg: new CapsuleGeometry(0.07, 0.08, 4, 10),
  foot: new SphereGeometry(0.085, 12, 8),
  upperArm: new CapsuleGeometry(0.062, 0.08, 4, 10),
  lowerArm: new CapsuleGeometry(0.058, 0.06, 4, 10),
  hand: new SphereGeometry(0.066, 12, 8),
  eye: new SphereGeometry(0.052, 14, 10),
  shine: new SphereGeometry(0.017, 8, 6),
  blush: new CircleGeometry(0.052, 18),
  smile: new TorusGeometry(0.032, 0.009, 6, 14, Math.PI),
  shadow: new CircleGeometry(0.34, 20).rotateX(-Math.PI / 2),
};

function toonGradient(): DataTexture {
  const tex = new DataTexture(new Uint8Array([110, 190, 255]), 3, 1, RedFormat);
  tex.minFilter = NearestFilter;
  tex.magFilter = NearestFilter;
  tex.needsUpdate = true;
  return tex;
}
const gradient = toonGradient();
const toonCache = new Map<string, MeshToonMaterial>();
function toon(color: string | number): MeshToonMaterial {
  const key = new Color(color).getHexString();
  let m = toonCache.get(key);
  if (!m) {
    m = new MeshToonMaterial({ color: new Color(color), gradientMap: gradient });
    toonCache.set(key, m);
  }
  return m;
}
const flat = {
  eye: new MeshBasicMaterial({ color: 0x2b2233 }),
  shine: new MeshBasicMaterial({ color: 0xffffff }),
  blush: new MeshBasicMaterial({ color: 0xff8fa3, transparent: true, opacity: 0.55, side: DoubleSide, depthWrite: false }),
  smile: new MeshBasicMaterial({ color: 0x7a3b3b }),
  shadow: new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false }),
};

const SKIN = ['#ffe3cc', '#f8d2b4', '#eab894', '#c99272'];
const HAIR = ['#2e2a2b', '#5b3a29', '#8a5a33', '#d8a46a', '#f1d27a', '#c8574f', '#7b61d9', '#ff9cbc', '#5fa8d3'];
const HAIR_STYLES = ['short', 'bun', 'twin', 'long', 'spiky'] as const;

function pick<T>(list: readonly T[], seed: number, salt: number): T {
  const x = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453;
  return list[Math.floor((x - Math.floor(x)) * list.length)];
}

function mesh(g: BufferGeometry, m: Material, x = 0, y = 0, z = 0): Mesh {
  const o = new Mesh(g, m);
  o.position.set(x, y, z);
  return o;
}

/** A limb hanging from a pivot: upper segment, a joint, lower segment, end cap. */
function limb(upperG: BufferGeometry, lowerG: BufferGeometry, endG: BufferGeometry, mat: Material, endMat: Material, upperLen: number, lowerLen: number) {
  const upper = new Group();
  upper.add(mesh(upperG, mat, 0, -upperLen / 2, 0));
  const joint = new Group();
  joint.position.y = -upperLen;
  joint.add(mesh(lowerG, mat, 0, -lowerLen / 2, 0));
  const end = mesh(endG, endMat, 0, -lowerLen - 0.02, 0);
  joint.add(end);
  upper.add(joint);
  return { upper, joint, end };
}

export interface FigureLook {
  color: string;
  seed: number;
  theme: Theme;
  coordinator: boolean;
  scale?: number;
}

export class ChibiFigure {
  readonly root = new Group();
  readonly label: CSS2DObject;
  readonly labelEl: HTMLDivElement;
  private readonly body = new Group();
  private readonly head = new Group();
  private readonly eyes: Mesh[] = [];
  private readonly legs: Array<ReturnType<typeof limb>>;
  private readonly arms: Array<ReturnType<typeof limb>>;
  private readonly baseScale: number;
  private path: Vector3[] = [];
  private onArrive: (() => void) | null = null;
  private yaw = 0;
  private targetYaw = 0;
  private phase = Math.random() * 10;
  private blinkIn = 1 + Math.random() * 3;
  private scaleT = 0;
  private dying = false;
  pose: Pose = 'stand';
  /** Walking speed multiplier (sub-agents hurry). */
  speed = 1;

  constructor(look: FigureLook) {
    const shirt = toon(look.color);
    const pants = toon(new Color(look.color).multiplyScalar(0.45).getHex());
    const skin = toon(pick(SKIN, look.seed, 1));
    const hair = toon(pick(HAIR, look.seed, 2));
    const shoes = toon('#6b4b3a');

    // Body.
    const torso = mesh(geo.torso, shirt, 0, 0.63, 0);
    torso.scale.set(1, 1, 0.85);
    this.body.add(torso);
    this.legs = [-0.085, 0.085].map((x) => {
      const l = limb(geo.upperLeg, geo.lowerLeg, geo.foot, pants, shoes, 0.17, 0.14);
      l.end.scale.set(1, 0.7, 1.35);
      l.end.position.z = 0.03;
      l.upper.position.set(x, HIP_Y, 0);
      this.body.add(l.upper);
      return l;
    });
    this.arms = [-0.215, 0.215].map((x) => {
      const a = limb(geo.upperArm, geo.lowerArm, geo.hand, shirt, skin, 0.13, 0.11);
      a.upper.position.set(x, 0.76, 0);
      a.upper.rotation.z = x < 0 ? -0.18 : 0.18;
      this.body.add(a.upper);
      return a;
    });

    // Head with face.
    this.head.position.y = 1.08;
    const skull = mesh(geo.head, skin);
    skull.scale.set(1.06, 0.96, 1);
    this.head.add(skull);
    for (const side of [-1, 1]) {
      const eye = mesh(geo.eye, flat.eye, side * 0.115, -0.01, 0.295);
      eye.scale.set(0.9, 1.25, 0.45);
      this.eyes.push(eye);
      const shine = mesh(geo.shine, flat.shine, side * 0.115 + 0.018, 0.025, 0.318);
      eye.userData.shine = shine;
      const blush = mesh(geo.blush, flat.blush, side * 0.2, -0.085, 0.262);
      blush.rotation.y = side * 0.62;
      blush.scale.set(1.3, 0.8, 1);
      this.head.add(eye, shine, blush);
    }
    const smile = mesh(geo.smile, flat.smile, 0, -0.1, 0.31);
    smile.rotation.z = Math.PI;
    this.head.add(smile);
    this.addHair(hair, pick(HAIR_STYLES, look.seed, 3));
    this.addAccessory(look);
    this.body.add(this.head);

    this.body.traverse((o) => {
      o.castShadow = false;
    });
    const shadow = mesh(geo.shadow, flat.shadow, 0, 0.02, 0);
    shadow.renderOrder = 2;
    this.root.add(this.body, shadow);
    this.baseScale = (look.scale ?? 1) * BODY_SCALE;
    this.root.scale.setScalar(0.001);

    this.labelEl = document.createElement('div');
    this.labelEl.className = 'fig-label';
    this.label = new CSS2DObject(this.labelEl);
    this.label.position.set(0, 1.62, 0);
    this.root.add(this.label);
  }

  private addHair(mat: Material, style: (typeof HAIR_STYLES)[number]): void {
    const cap = mesh(geo.hairCap, mat, 0, 0.015, -0.025);
    cap.rotation.x = -0.42;
    cap.scale.set(1.06, 1, 1.04);
    this.head.add(cap);
    // Bangs: a few soft lumps along the hairline.
    for (const [x, y, s] of [[-0.17, 0.2, 1], [-0.05, 0.25, 1.15], [0.08, 0.24, 1.1], [0.19, 0.18, 0.95]]) {
      const b = mesh(geo.hairBall, mat, x, y, 0.2);
      b.scale.setScalar(s);
      b.scale.z = 0.7;
      this.head.add(b);
    }
    if (style === 'bun') {
      const bun = mesh(geo.hairBall, mat, 0, 0.36, -0.08);
      bun.scale.setScalar(1.25);
      this.head.add(bun);
    } else if (style === 'twin') {
      for (const side of [-1, 1]) {
        const t = mesh(geo.hairBall, mat, side * 0.34, -0.02, -0.05);
        t.scale.set(0.95, 1.4, 0.95);
        this.head.add(t);
      }
    } else if (style === 'long') {
      const back = mesh(geo.hairLong, mat, 0, -0.16, -0.17);
      back.scale.set(1.45, 1, 0.7);
      this.head.add(back);
    } else if (style === 'spiky') {
      for (const [x, rz] of [[-0.14, 0.5], [0, 0], [0.14, -0.5]]) {
        const spike = mesh(new ConeGeometry(0.08, 0.18, 8), mat, x, 0.37, -0.02);
        spike.rotation.z = rz;
        this.head.add(spike);
      }
    }
  }

  /** A small prop that says what the room does. */
  private addAccessory(look: FigureLook): void {
    const h = this.head;
    if (look.coordinator) {
      const gold = new MeshToonMaterial({ color: '#ffc94d', gradientMap: gradient, side: DoubleSide });
      h.add(mesh(new CylinderGeometry(0.11, 0.12, 0.07, 10, 1, true), gold, 0, 0.36, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        h.add(mesh(new ConeGeometry(0.025, 0.06, 6), gold, Math.sin(a) * 0.11, 0.42, Math.cos(a) * 0.11));
      }
      return;
    }
    switch (look.theme) {
      case 'hardware':
      case 'robot': {
        const hat = mesh(new SphereGeometry(0.36, 20, 10, 0, Math.PI * 2, 0, 1.35), toon('#ffcf33'), 0, 0.06, 0);
        h.add(hat, mesh(new CylinderGeometry(0.42, 0.42, 0.025, 20), toon('#ffcf33'), 0, 0.13, 0.04));
        break;
      }
      case 'review':
      case 'test':
      case 'research':
      case 'report': {
        const frame = toon('#3a3340');
        for (const side of [-1, 1]) {
          const ring = mesh(new TorusGeometry(0.075, 0.012, 6, 18), frame, side * 0.115, -0.01, 0.325);
          h.add(ring);
        }
        h.add(mesh(new BoxGeometry(0.08, 0.015, 0.015), frame, 0, 0.0, 0.33));
        break;
      }
      case 'video':
      case 'design': {
        const beret = mesh(new SphereGeometry(0.3, 18, 8, 0, Math.PI * 2, 0, 0.9), toon('#c0392b'), -0.04, 0.2, -0.02);
        beret.scale.set(1.15, 0.5, 1.15);
        beret.rotation.z = 0.25;
        h.add(beret);
        break;
      }
      case 'audio':
      case 'code':
      case 'sim': {
        const band = toon('#3d3d4a');
        h.add(mesh(new TorusGeometry(0.35, 0.025, 6, 24, Math.PI), band, 0, 0.02, 0));
        for (const side of [-1, 1]) {
          const cup = mesh(new CylinderGeometry(0.08, 0.08, 0.07, 14), toon(look.color), side * 0.35, -0.02, 0);
          cup.rotation.z = Math.PI / 2;
          h.add(cup);
        }
        break;
      }
      case 'pcb':
      case 'firmware': {
        const cap = mesh(new SphereGeometry(0.355, 20, 10, 0, Math.PI * 2, 0, 1.25), toon(look.color), 0, 0.03, 0);
        const brim = mesh(new CylinderGeometry(0.2, 0.2, 0.025, 16, 1, false, -Math.PI / 2, Math.PI), toon(look.color), 0, 0.17, 0.25);
        h.add(cap, brim);
        break;
      }
      default: {
        // A little bow.
        const pink = toon('#ff7aa2');
        for (const side of [-1, 1]) {
          const lobe = mesh(new ConeGeometry(0.07, 0.12, 10), pink, 0.2 + side * 0.06, 0.28, 0.06);
          lobe.rotation.z = side * Math.PI / 2;
          h.add(lobe);
        }
        h.add(mesh(geo.shine, pink, 0.2, 0.28, 0.07));
      }
    }
  }

  get position(): Vector3 {
    return this.root.position;
  }

  get walking(): boolean {
    return this.path.length > 0;
  }

  walk(points: Vector3[], onArrive?: () => void): void {
    this.path = points.map((p) => p.clone());
    this.onArrive = onArrive ?? null;
  }

  face(yaw: number): void {
    this.targetYaw = yaw;
  }

  vanish(): void {
    this.dying = true;
  }

  get gone(): boolean {
    return this.dying && this.scaleT <= 0;
  }

  update(dt: number): void {
    this.phase += dt;
    this.scaleT = Math.min(1, Math.max(0, this.scaleT + (this.dying ? -dt * 3 : dt * 2.5)));
    const pop = this.dying ? this.scaleT : easeOutBack(this.scaleT);
    this.root.scale.setScalar(Math.max(0.001, pop * this.baseScale));

    const moving = this.advance(dt);
    let d = this.targetYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * TURN_RATE);
    this.root.rotation.y = this.yaw;
    this.animate(moving);
    this.blink(dt);
  }

  private blink(dt: number): void {
    this.blinkIn -= dt;
    const closing = this.blinkIn < 0;
    for (const eye of this.eyes) {
      eye.scale.y = closing ? 0.15 : 1.25;
      (eye.userData.shine as Mesh).visible = !closing;
    }
    if (this.blinkIn < -0.12) this.blinkIn = 2 + Math.random() * 3.5;
  }

  private advance(dt: number): boolean {
    if (this.path.length === 0) return false;
    const target = this.path[0];
    const pos = this.root.position;
    const delta = target.clone().sub(pos);
    const vertical = Math.abs(delta.y) > 0.01 && Math.hypot(delta.x, delta.z) < 0.05;
    const step = (vertical ? LIFT_SPEED : WALK_SPEED) * this.speed * dt;
    const dist = delta.length();
    if (dist <= step) {
      pos.copy(target);
      this.path.shift();
      if (this.path.length === 0) {
        const cb = this.onArrive;
        this.onArrive = null;
        cb?.();
      }
    } else {
      pos.addScaledVector(delta, step / dist);
      if (!vertical) this.targetYaw = Math.atan2(delta.x, delta.z);
    }
    return !vertical;
  }

  private animate(moving: boolean): void {
    const [lL, lR] = this.legs;
    const [aL, aR] = this.arms;
    const t = this.phase;
    const set = (l: ReturnType<typeof limb>, upper: number, lower: number) => {
      l.upper.rotation.x = upper;
      l.joint.rotation.x = lower;
    };
    let bodyY = 0;
    let headTilt = 0;
    aR.upper.rotation.z = 0.18;

    if (moving) {
      const s = Math.sin(t * 11);
      set(lL, s * 0.7, Math.max(0, -s) * 0.6);
      set(lR, -s * 0.7, Math.max(0, s) * 0.6);
      set(aL, -s * 0.7, -0.4);
      set(aR, s * 0.7, -0.4);
      bodyY = Math.abs(Math.cos(t * 11)) * 0.05;
      headTilt = Math.sin(t * 11) * 0.05;
    } else if (this.pose === 'sit' || this.pose === 'type') {
      bodyY = SEAT_HIP_Y / BODY_SCALE - HIP_Y;
      set(lL, -Math.PI / 2, Math.PI / 2 - Math.sin(t * 2) * 0.15);
      set(lR, -Math.PI / 2, Math.PI / 2 + Math.sin(t * 2) * 0.15);
      if (this.pose === 'type') {
        set(aL, -1.25 + Math.sin(t * 18) * 0.15, -0.5);
        set(aR, -1.25 + Math.sin(t * 18 + 1.7) * 0.15, -0.5);
        headTilt = Math.sin(t * 1.3) * 0.04 - 0.08;
      } else {
        set(aL, -0.5, -0.6);
        set(aR, -0.5, -0.6);
        headTilt = Math.sin(t * 1.1) * 0.12;
      }
    } else if (this.pose === 'wave') {
      set(lL, 0, 0);
      set(lR, 0, 0);
      set(aL, 0.1, -0.2);
      aR.upper.rotation.x = 0;
      aR.upper.rotation.z = 2.5 + Math.sin(t * 9) * 0.35;
      aR.joint.rotation.x = 0;
      bodyY = Math.abs(Math.sin(t * 4.5)) * 0.06;
      headTilt = Math.sin(t * 4.5) * 0.1;
    } else {
      set(lL, 0, 0);
      set(lR, 0, 0);
      set(aL, Math.sin(t * 1.6) * 0.08, -0.15);
      set(aR, -Math.sin(t * 1.6) * 0.08, -0.15);
      bodyY = Math.sin(t * 2.2) * 0.012;
      headTilt = Math.sin(t * 0.9) * 0.08;
    }
    this.body.position.y = bodyY;
    this.head.rotation.z = headTilt;
  }

  dispose(): void {
    this.label.element.remove();
    this.root.removeFromParent();
  }
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
