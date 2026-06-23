import * as THREE from "three";
import { CALDER_BLACK, GALLERY, pick, plateColor } from "../palette";
import type { Creation } from "../creation";

// A Calder kinetic sculpture, generated fresh each time.
//
// The defining gesture is a CASCADE, not a symmetric tree: a chain of long, thin,
// gently-arcing wire levers. Each lever hangs from one point and pivots freely;
// on its SHORT end hangs a counterweight plate, and from its LONG end the cascade
// CONTINUES to the next lever — so the whole thing sweeps sideways and steps down,
// much wider than it is tall (cf. Calder's hanging mobiles). The painted plates
// are a single shape family per piece (teardrop / comma / kite), all hanging
// broadside as flat near-coplanar sheets — a flock, all facing roughly one way —
// turning slowly as if stirred by air. A piece is either HANGING from a ceiling
// point or STANDING on bold arched tripod legs.
//
// Still generative, not torque-true: balance and air response are eyeballed.

// ---- materials -------------------------------------------------------------
const plateMats = new Map<number, THREE.MeshStandardMaterial>();
function plateMat(color: number): THREE.MeshStandardMaterial {
  let m = plateMats.get(color);
  if (!m) {
    // emissive of the same hue keeps the Bauhaus primaries poster-flat and
    // vivid even where the light doesn't directly hit (shadow-casting is
    // unaffected by emissive, so the cast shadows stay).
    m = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.32,
      side: THREE.DoubleSide,
      roughness: 0.7,
      metalness: 0.0,
    });
    plateMats.set(color, m);
  }
  return m;
}
const wireMats = new Map<number, THREE.MeshStandardMaterial>();
function wireMatOf(color: number): THREE.MeshStandardMaterial {
  let m = wireMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.15 });
    wireMats.set(color, m);
  }
  return m;
}
let WIRE: THREE.MeshStandardMaterial = wireMatOf(CALDER_BLACK); // set per build

// ---- plate shapes (built in the XY plane, facing +Z, point/attach near top) --
function teardrop(s: number): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(0, 1.3 * s);
  sh.bezierCurveTo(0.95 * s, 0.7 * s, 0.82 * s, -0.7 * s, 0, -1.05 * s);
  sh.bezierCurveTo(-0.82 * s, -0.7 * s, -0.95 * s, 0.7 * s, 0, 1.3 * s);
  return sh;
}
function comma(s: number): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(0, 1.3 * s);
  sh.bezierCurveTo(1.15 * s, 0.5 * s, 0.82 * s, -0.92 * s, -0.18 * s, -1.0 * s);
  sh.bezierCurveTo(-0.98 * s, -0.55 * s, -0.5 * s, 0.62 * s, 0, 1.3 * s);
  return sh;
}
function kite(s: number): THREE.Shape {
  const sh = new THREE.Shape();
  sh.moveTo(0, 1.3 * s);
  sh.lineTo(0.9 * s, 0.05 * s);
  sh.lineTo(0.32 * s, -1.2 * s);
  sh.lineTo(-0.78 * s, -0.5 * s);
  sh.closePath();
  return sh;
}
function disc(s: number): THREE.Shape {
  const sh = new THREE.Shape();
  sh.absarc(0, 0, s, 0, Math.PI * 2, false);
  return sh;
}
function crescent(s: number): THREE.Shape {
  const sh = new THREE.Shape();
  sh.absarc(0, 0, s, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(s * 0.55, s * 0.1, s * 0.82, 0, Math.PI * 2, true);
  sh.holes.push(hole);
  return sh;
}
type ShapeFn = (s: number) => THREE.Shape;
const FAMILIES: ShapeFn[] = [teardrop, comma, kite]; // one dominant family per piece
const ACCENTS: ShapeFn[] = [disc, crescent]; // occasional round accent

// ---- wires -----------------------------------------------------------------
function tube(pts: THREE.Vector3[], r: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, r, 7, false), WIRE);
  m.castShadow = true;
  return m;
}
// a near-horizontal arm spanning x0..x1, sagging by `droop` at the middle.
function armWire(x0: number, x1: number, droop: number): THREE.Mesh {
  return tube(
    [new THREE.Vector3(x0, 0, 0), new THREE.Vector3((x0 + x1) / 2, -droop, 0), new THREE.Vector3(x1, 0, 0)],
    0.05,
  );
}
function dropWire(len: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.045, 0.045, len, 7);
  const m = new THREE.Mesh(geo, WIRE);
  m.position.y = -len / 2;
  m.castShadow = true;
  return m;
}
function knuckle(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), WIRE);
  m.castShadow = true;
  return m;
}

// A plate hanging from a short link at the arm's end. Origin = the attach point
// (top); the painted sheet dangles below, broadside, facing `facing` with a hair
// of tilt. `up` flips it to stand above the wire (the leading petals in Calder's
// fans). The pivot above it turns it slowly.
function hangPlate(size: number, color: number, family: ShapeFn, facing: number, up: boolean): THREE.Object3D {
  const g = new THREE.Group();
  const linkLen = 0.4 + Math.random() * 0.7;
  g.add(dropWire(linkLen));
  g.add(knuckle());

  const geo = new THREE.ShapeGeometry(family(size), 28);
  geo.computeBoundingBox();
  const bb = geo.boundingBox!;
  const plate = new THREE.Mesh(geo, plateMat(color));
  plate.castShadow = true;
  plate.receiveShadow = true;

  const orient = new THREE.Group();
  orient.position.y = -linkLen;
  orient.rotation.y = facing + (Math.random() - 0.5) * 0.5;
  orient.rotation.x = (Math.random() - 0.5) * 0.3;
  if (up) {
    plate.position.y = -bb.min.y; // bottom tip at the attach point, body above
  } else {
    plate.position.y = -bb.max.y; // top point at the attach point, body below
  }
  orient.add(plate);
  g.add(orient);
  return g;
}

interface Pivot {
  obj: THREE.Object3D;
  drift: number; swayAmp: number; swayFreq: number; phase: number; tiltAmp: number; tiltFreq: number;
}

const GALLERIES = [GALLERY, 0xe9e7df, 0xeeece6, 0xe6e8e6];

export function createMobile(): Creation {
  const group = new THREE.Group();
  const pivots: Pivot[] = [];

  // ---- per-piece character -------------------------------------------------
  const family = pick(FAMILIES);
  const facing = (Math.random() - 0.5) * 0.8; // the flock's shared facing
  const wireColor = Math.random() < 0.3 ? 0xb5402f : CALDER_BLACK; // sometimes warm red
  WIRE = wireMatOf(wireColor);
  const sizeBoost = 0.8 + Math.random() * 0.5;

  function shapeFor(): ShapeFn {
    return Math.random() < 0.12 ? pick(ACCENTS) : family;
  }

  function registerPivot(obj: THREE.Object3D, depth: number) {
    const spd = 0.05 + depth * 0.045;
    pivots.push({
      obj,
      drift: (Math.random() < 0.5 ? 1 : -1) * (0.03 + Math.random() * spd),
      swayAmp: 0.04 + Math.random() * 0.1,
      swayFreq: 0.25 + Math.random() * 0.55,
      phase: Math.random() * Math.PI * 2,
      tiltAmp: depth === 0 ? 0 : 0.015 + Math.random() * 0.04,
      tiltFreq: 0.4 + Math.random() * 0.8,
    });
  }

  // One lever in the cascade. Origin = its top attach point; pivots about the
  // drop wire. Short end -> counterweight plate. Long end -> the cascade
  // continues (or a terminal plate at the tip). `dir` (+1/-1) is the sweep.
  function buildLever(depth: number, dir: number, maxDepth: number): THREE.Object3D {
    const unit = new THREE.Group();
    const drop = 1.2 + Math.random() * 1.8;
    unit.add(dropWire(drop));

    const pivot = new THREE.Group();
    pivot.position.y = -drop;
    pivot.add(knuckle());
    unit.add(pivot);

    const longLen = (5 + Math.random() * 5) / (1 + depth * 0.12);
    const shortLen = 1.6 + Math.random() * 2.4;
    const xLong = dir * longLen;
    const xShort = -dir * shortLen;
    const droop = 0.35 + Math.random() * 1.3;
    pivot.add(armWire(Math.min(xLong, xShort), Math.max(xLong, xShort), droop));

    const armEndY = -droop * 0.85; // the sagging wire reaches the ends a little low

    // counterweight on the short end (the bigger plate)
    const cwSize = Math.max(0.9, (2.6 - depth * 0.18 + Math.random() * 0.8) * sizeBoost);
    const cw = hangPlate(cwSize, plateColor(), shapeFor(), facing, false);
    cw.position.set(xShort, armEndY, 0);
    pivot.add(cw);
    registerPivot(cw, depth + 1);

    // an occasional small leading petal standing up at the short joint (fans)
    if (Math.random() < 0.4) {
      const leadDir = Math.random() < 0.6;
      const lead = hangPlate(cwSize * 0.55, plateColor(), shapeFor(), facing, leadDir);
      lead.position.set(xShort * 0.4, armEndY + 0.2, 0);
      pivot.add(lead);
      registerPivot(lead, depth + 2);
    }

    // long end: continue the cascade, or terminate in a plate at the tip
    if (depth < maxDepth && Math.random() < 0.9) {
      const nextDir = Math.random() < 0.15 ? -dir : dir; // mostly keep sweeping one way
      const child = buildLever(depth + 1, nextDir, maxDepth);
      child.position.set(xLong, armEndY, 0);
      pivot.add(child);
    } else {
      const tipSize = Math.max(0.8, (2.0 - depth * 0.12 + Math.random() * 0.7) * sizeBoost);
      const tip = hangPlate(tipSize, plateColor(), shapeFor(), facing, false);
      tip.position.set(xLong, armEndY, 0);
      pivot.add(tip);
      registerPivot(tip, depth + 1);
    }

    registerPivot(pivot, depth);
    return unit;
  }

  // ---- mount: hanging point, or a standing arched-tripod base --------------
  const FLOOR = -20;
  const standing = Math.random() < 0.45;
  const dir0 = Math.random() < 0.5 ? 1 : -1;

  let anchorY: number;
  let maxDepth: number;
  if (standing) {
    // bold arched legs (cf. Calder's "elephant foot" stabile bases) up to a hub,
    // with a smaller mobile balanced on top.
    const hubY = FLOOR + 14 + Math.random() * 4;
    const legColor = Math.random() < 0.5 ? 0xc0392b : CALDER_BLACK;
    const legMat = wireMatOf(legColor);
    const legs = 3;
    const footR = 7 + Math.random() * 3;
    const a0 = Math.random() * Math.PI * 2;
    for (let i = 0; i < legs; i++) {
      const a = a0 + (i / legs) * Math.PI * 2;
      const fx = Math.cos(a) * footR;
      const fz = Math.sin(a) * footR;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, hubY, 0),
        new THREE.Vector3(fx * 0.35, hubY - (hubY - FLOOR) * 0.45, fz * 0.35),
        new THREE.Vector3(fx * 0.9, FLOOR + 1.5, fz * 0.9),
        new THREE.Vector3(fx, FLOOR, fz),
      ]);
      const leg = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.32, 10, false), legMat);
      leg.castShadow = true;
      leg.receiveShadow = true;
      group.add(leg);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), legMat);
    hub.position.set(0, hubY, 0);
    hub.castShadow = true;
    group.add(hub);
    anchorY = hubY;
    maxDepth = 2 + Math.floor(Math.random() * 2); // keep the top mobile compact
  } else {
    anchorY = 13 + Math.random() * 5;
    const anchor = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), WIRE);
    anchor.position.set(0, anchorY, 0);
    anchor.castShadow = true;
    group.add(anchor);
    maxDepth = 4 + Math.floor(Math.random() * 3); // a long sweeping cascade
  }

  const root = buildLever(0, dir0, maxDepth);
  root.position.set(0, anchorY, 0);
  group.add(root);

  // ---- auto-frame: Calder mobiles are wide — fit the whole span ------------
  const box = new THREE.Box3().setFromObject(group);
  const c = box.getCenter(new THREE.Vector3());
  const sz = box.getSize(new THREE.Vector3());
  const span = Math.max(sz.x, sz.y, 8);
  const dist = span * 1.15 + 14;

  // ---- random key-light direction (shadows fall differently each render) ----
  const lightAz = Math.random() * Math.PI * 2;
  const lightEl = 0.7 + Math.random() * 0.6;
  const lr = 50;
  const light = {
    position: [
      c.x + Math.cos(lightAz) * Math.cos(lightEl) * lr,
      Math.sin(lightEl) * lr + 12,
      Math.sin(lightAz) * Math.cos(lightEl) * lr,
    ] as [number, number, number],
    intensity: 1.0 + Math.random() * 0.3,
    color: pick([0xfff6e8, 0xfff1da, 0xfdfbff, 0xffeede]),
  };

  return {
    name: "Mobile",
    group,
    background: pick(GALLERIES),
    camera: [c.x + dist * 0.1, c.y + sz.y * 0.04, c.z + dist],
    target: [c.x, c.y, c.z],
    light,
    update: (time, autoRotate) => {
      if (!autoRotate) return;
      for (const p of pivots) {
        p.obj.rotation.y = p.drift * time + p.swayAmp * Math.sin(time * p.swayFreq + p.phase);
        if (p.tiltAmp) p.obj.rotation.z = p.tiltAmp * Math.sin(time * p.tiltFreq + p.phase);
      }
    },
  };
}
