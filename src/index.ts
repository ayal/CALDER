import * as THREE from "three";
import { TrackballControls } from "three/examples/jsm/controls/TrackballControls.js";
import type { Creation } from "./creation";
import { createMobile } from "./creations/mobile";
import { GALLERY } from "./palette";

// ---------------------------------------------------------------------------
// Shared scene / renderer / camera / controls / lights
// ---------------------------------------------------------------------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setClearColor(new THREE.Color(GALLERY));
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
// shadows are central to a Calder piece — the plates throw their silhouettes on
// the floor as they turn.
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// soft ambient + hemisphere fill, plus one key light that casts the shadows.
const hemi = new THREE.HemisphereLight(0xffffff, 0xc4c2ba, 0.95);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xfff6e8, 1.15);
key.position.set(18, 40, 22);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 140;
const S = 50;
key.shadow.camera.left = -S;
key.shadow.camera.right = S;
key.shadow.camera.top = S;
key.shadow.camera.bottom = -S;
key.shadow.bias = -0.0004;
scene.add(key);
scene.add(key.target);

// A large floor that only shows the shadow (transparent ShadowMaterial), so the
// mobile reads as floating above a clean gallery floor of the clear colour.
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  new THREE.ShadowMaterial({ opacity: 0.28 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -20;
floor.receiveShadow = true;
scene.add(floor);

// TrackballControls: free tumble; 1 finger rotates, two fingers zoom/pan.
const controls = new TrackballControls(camera, renderer.domElement);
controls.dynamicDampingFactor = 0.12;
controls.rotateSpeed = 2.2;
renderer.domElement.addEventListener("dblclick", (e) => e.preventDefault());

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------
const BTN = "border:none;background:none;cursor:pointer;padding:0;font:13px sans-serif;letter-spacing:.02em;";
const bar = document.createElement("div");
bar.style.cssText = "position:fixed;top:14px;left:16px;z-index:9999;display:flex;gap:16px;align-items:center;";
document.body.appendChild(bar);

function styleBtn(b: HTMLButtonElement, on: boolean) {
  b.style.cssText = BTN + `color:${on ? "#111" : "#6a6d72"};font-weight:${on ? "700" : "400"};`;
}
function makeToggle(label: string, initial: boolean, onChange: (on: boolean) => void) {
  const b = document.createElement("button");
  let on = initial;
  b.textContent = label;
  styleBtn(b, on);
  b.onclick = () => { on = !on; styleBtn(b, on); onChange(on); };
  (b as any).setOn = (v: boolean) => { on = v; styleBtn(b, on); };
  return b;
}

// ---------------------------------------------------------------------------
// Creation management
// ---------------------------------------------------------------------------
let current: Creation | null = null;
let autoRotate = true;
let spinBtn: (HTMLButtonElement & { setOn?: (v: boolean) => void }) | null = null;

function disposeGroup(g: THREE.Group) {
  g.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
  });
}

function setSpin(on: boolean) {
  autoRotate = on;
  spinBtn?.setOn?.(on);
}

function buildUI() {
  bar.replaceChildren();
  const refresh = document.createElement("button");
  refresh.textContent = "↻";
  styleBtn(refresh, false);
  refresh.style.fontSize = "17px";
  refresh.style.lineHeight = "1";
  refresh.title = "new mobile";
  refresh.onclick = () => setCreation();
  bar.appendChild(refresh);

  const sep = document.createElement("span");
  sep.textContent = "·";
  sep.style.cssText = "color:#9a9da1;";
  bar.appendChild(sep);

  spinBtn = makeToggle("drift", autoRotate, setSpin);
  bar.appendChild(spinBtn);

  for (const tg of current?.toggles ?? []) {
    tg.set(tg.initial);
    bar.appendChild(makeToggle(tg.label, tg.initial, tg.set));
  }
}

function setCreation() {
  if (current) {
    scene.remove(current.group);
    current.dispose?.();
    disposeGroup(current.group);
  }
  current = createMobile();
  renderer.setClearColor(new THREE.Color(current.background ?? GALLERY));
  if (current.light) {
    key.position.set(...current.light.position);
    if (current.light.intensity !== undefined) key.intensity = current.light.intensity;
    if (current.light.color !== undefined) key.color.set(current.light.color);
  }
  scene.add(current.group);

  autoRotate = true;
  frameCreation(current);
  buildUI();
}

// Fit the camera so the whole piece is in view: back off by exactly the
// distance that fits its bounding sphere inside the smaller of the vertical /
// horizontal FOV (so wide mobiles fill the frame without spilling). The
// creation's suggested `camera` is used only as a viewing direction.
function frameCreation(c: Creation) {
  const box = new THREE.Box3().setFromObject(c.group);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const radius = box.getBoundingSphere(new THREE.Sphere()).radius;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  const vfov = THREE.MathUtils.degToRad(camera.fov);
  const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect);
  const dist = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * 1.12; // 12% margin

  const tgt = new THREE.Vector3(...(c.target ?? [center.x, center.y, center.z]));
  const dir = new THREE.Vector3(...c.camera).sub(tgt);
  if (dir.lengthSq() < 1e-4) dir.set(0.12, 0.05, 1);
  dir.normalize();

  camera.up.set(0, 1, 0);
  camera.position.copy(center).addScaledVector(dir, dist);
  controls.target.copy(center);
  controls.update();
}

setCreation();

// ---------------------------------------------------------------------------
// Render loop
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const animate = () => {
  requestAnimationFrame(animate);
  current?.update?.(clock.getElapsedTime(), autoRotate, { renderer, scene });
  renderer.render(scene, camera);
  controls.update();
};
animate();
