import * as THREE from "three";
import { CALDER_BLACK, GALLERY, plateColor } from "../palette";
import type { Creation } from "../creation";

// A Calder hanging mobile: a recursively balanced binary tree of thin black
// wire arms. Every arm hangs from a single point and pivots freely about its
// suspension wire; at each end hangs either another arm or a flat painted plate
// (a disc or an organic "leaf" blob, in Calder's primaries). The whole thing
// drifts as if stirred by air currents — each pivot turns at its own slow rate
// with a gentle sway, so the silhouette is never the same twice.
//
// Shadows and lighting are set up by index.ts; here we just flag meshes as
// shadow casters. A first pass — masses/lengths are eyeballed, not physically
// balanced; refinement (true torque balance, curved wires, wind model) later.

// ---- materials cache (shared per colour, so we don't make N identical mats) --
const plateMats = new Map<number, THREE.MeshStandardMaterial>();
function plateMat(color: number): THREE.MeshStandardMaterial {
  let m = plateMats.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      side: THREE.DoubleSide,
      roughness: 0.55,
      metalness: 0.0,
      // a hair of flatness — Calder's plates are matte painted sheet metal
    });
    plateMats.set(color, m);
  }
  return m;
}
const wireMat = new THREE.MeshStandardMaterial({
  color: CALDER_BLACK,
  roughness: 0.5,
  metalness: 0.1,
});

// ---- plate shapes ----------------------------------------------------------
// A flat, slightly thick plate so it catches light and casts a real shadow.
function discPlate(radius: number, color: number): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 40);
  const mesh = new THREE.Mesh(geo, plateMat(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// An organic "leaf"/petal blob via a closed bezier outline — Calder's biomorphic
// shapes. Built around the origin, roughly `size` across.
function leafPlate(size: number, color: number): THREE.Mesh {
  const s = size;
  const shape = new THREE.Shape();
  shape.moveTo(-s * 0.9, 0);
  shape.bezierCurveTo(-s * 0.9, s * 0.7, -s * 0.3, s * 0.95, s * 0.2, s * 0.55);
  shape.bezierCurveTo(s * 0.7, s * 0.25, s * 1.05, -s * 0.1, s * 0.85, -s * 0.45);
  shape.bezierCurveTo(s * 0.6, -s * 0.8, -s * 0.2, -s * 0.7, -s * 0.6, -s * 0.4);
  shape.bezierCurveTo(-s * 0.85, -s * 0.2, -s * 0.9, -s * 0.1, -s * 0.9, 0);
  const geo = new THREE.ShapeGeometry(shape, 24);
  const mesh = new THREE.Mesh(geo, plateMat(color));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function makePlate(size: number, color: number): THREE.Mesh {
  return Math.random() < 0.5 ? discPlate(size, color) : leafPlate(size * 1.1, color);
}

// A thin horizontal wire arm from x=x0 to x=x1 (a stretched, rotated cylinder).
function armWire(x0: number, x1: number): THREE.Mesh {
  const len = Math.abs(x1 - x0);
  const geo = new THREE.CylinderGeometry(0.06, 0.06, len, 8);
  geo.rotateZ(Math.PI / 2); // lay it along X
  const mesh = new THREE.Mesh(geo, wireMat);
  mesh.position.x = (x0 + x1) / 2;
  mesh.castShadow = true;
  return mesh;
}

// A short vertical drop wire from y=0 down to y=-len.
function dropWire(len: number): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(0.05, 0.05, len, 8);
  const mesh = new THREE.Mesh(geo, wireMat);
  mesh.position.y = -len / 2;
  mesh.castShadow = true;
  return mesh;
}

// An animated pivot — a node that turns about its vertical suspension wire.
interface Pivot {
  obj: THREE.Object3D;
  drift: number; // continuous slow rotation (rad/sec)
  swayAmp: number; // oscillation amplitude (rad)
  swayFreq: number; // oscillation rate
  phase: number;
  tiltAmp: number; // gentle z-tilt for liveliness
  tiltFreq: number;
}

export function createMobile(): Creation {
  const group = new THREE.Group();
  const pivots: Pivot[] = [];

  // Build one suspended unit. Its local origin is the attachment point at the
  // TOP (where its drop wire connects to the parent arm); it hangs downward.
  // `depth` grows toward the leaves; deeper => smaller, more leaf-likely.
  function buildUnit(depth: number, prevColor?: number): THREE.Object3D {
    const unit = new THREE.Group();

    const drop = 1.6 + Math.random() * 2.2; // length of this unit's hang wire
    unit.add(dropWire(drop));

    const pivot = new THREE.Group();
    pivot.position.y = -drop;
    unit.add(pivot);

    // probability of being a terminal plate climbs with depth
    const leafChance = 0.18 + depth * 0.26;
    const isLeaf = depth >= 4 || Math.random() < leafChance;

    if (isLeaf) {
      const size = 2.4 - depth * 0.28 + Math.random() * 0.8;
      const color = plateColor(prevColor);
      const plate = makePlate(Math.max(0.7, size), color);
      // hang the plate flat-ish but tipped so it reads as a dangling sheet
      plate.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.5;
      plate.rotation.z = (Math.random() - 0.5) * 0.4;
      plate.position.y = -0.2;
      pivot.add(plate);
    } else {
      // a horizontal arm: extends left (-) and right (+) by different amounts,
      // hung off-centre so the two sides counterbalance (eyeballed for now).
      const leftLen = 3 + Math.random() * 5;
      const rightLen = 3 + Math.random() * 5;
      pivot.add(armWire(-leftLen, rightLen));

      // tiny knuckle discs at the hang point and the two ends
      const left = buildUnit(depth + 1, prevColor);
      left.position.x = -leftLen;
      const right = buildUnit(depth + 1, prevColor);
      right.position.x = rightLen;
      pivot.add(left, right);
    }

    // register the pivot's drift/sway. Deeper, lighter units react faster.
    const spd = 0.06 + depth * 0.05;
    pivots.push({
      obj: pivot,
      drift: (Math.random() < 0.5 ? 1 : -1) * (0.04 + Math.random() * spd),
      swayAmp: 0.05 + Math.random() * 0.12,
      swayFreq: 0.3 + Math.random() * 0.6,
      phase: Math.random() * Math.PI * 2,
      tiltAmp: depth === 0 ? 0 : 0.02 + Math.random() * 0.05,
      tiltFreq: 0.4 + Math.random() * 0.8,
    });

    return unit;
  }

  // Root: a fixed ceiling anchor with a short stem, then the whole mobile hangs.
  const TOP = 17;
  const anchor = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 16, 12),
    wireMat,
  );
  anchor.position.y = TOP;
  anchor.castShadow = true;
  group.add(anchor);

  const root = buildUnit(0);
  root.position.y = TOP;
  group.add(root);

  return {
    name: "Mobile",
    group,
    background: GALLERY,
    camera: [18, 6, 44],
    target: [0, 2, 0],
    update: (time, autoRotate) => {
      if (!autoRotate) return;
      for (const p of pivots) {
        p.obj.rotation.y =
          p.drift * time + p.swayAmp * Math.sin(time * p.swayFreq + p.phase);
        if (p.tiltAmp) {
          p.obj.rotation.z = p.tiltAmp * Math.sin(time * p.tiltFreq + p.phase);
        }
      }
    },
  };
}
