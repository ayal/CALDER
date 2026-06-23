import * as THREE from "three";

// A switchable artwork. Each creation builds a THREE.Group and suggests a
// camera position; index.ts handles the shared scene, lights, controls and
// switching.
// A feature toggle a creation exposes (shown as a sub-button in the UI).
export interface Toggle {
  label: string;
  initial: boolean;
  set: (on: boolean) => void;
}

export interface Creation {
  name: string;
  group: THREE.Group;
  camera: [number, number, number]; // suggested camera position
  target?: [number, number, number]; // optional orbit target (defaults to origin)
  background?: number; // optional scene clear color (defaults to gallery off-white)
  // optional key-light suggestion — lets a creation throw its shadows from a
  // different direction/warmth each render (index.ts applies it).
  light?: { position: [number, number, number]; intensity?: number; color?: number };
  update?: (
    time: number,
    autoRotate: boolean,
    env?: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; strength?: number },
  ) => void;
  toggles?: Toggle[]; // optional feature toggles
  dispose?: () => void; // tear down any DOM/listeners it added
}

export type CreationFactory = () => Creation;
