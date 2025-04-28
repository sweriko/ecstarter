import * as THREE  from 'three';
import { pipe, defineQuery } from 'bitecs';
import { world, meshes, bodies } from './world';
import {
  Position, Rotation, MeshRef, BodyRef,
  Life, ProjectileTag
} from './components';
import { pollInput } from './input';

/* globals injected by main.ts */
declare const renderer: THREE.WebGLRenderer;
declare const scene: THREE.Scene;
declare const camera: THREE.PerspectiveCamera;
declare const rapierWorld: import('@dimforge/rapier3d').World;

/* ────────────────────── time ─ */
export const timeSystem = (w = world) => {
  const now          = performance.now();
  w.time.delta       = (now - w.time.then) / 1000;
  w.time.elapsed    += w.time.delta;
  w.time.then        = now;
  return w;
};

/* ────────────────────── physics step ─ */
const bodyQuery = defineQuery([BodyRef, Position, Rotation]);
export const physicsSystem = (w = world) => {
  rapierWorld.step();

  for (const eid of bodyQuery(w)) {
    const rb   = bodies[BodyRef.id[eid]];
    const pos  = rb.translation();
    const rot  = rb.rotation();

    Position.x[eid] = pos.x; Position.y[eid] = pos.y; Position.z[eid] = pos.z;
    Rotation.x[eid] = rot.x; Rotation.y[eid] = rot.y;
    Rotation.z[eid] = rot.z; Rotation.w[eid] = rot.w;
  }
  return w;
};

/* ────────────────────── projectile lifetime ─ */
const projQuery = defineQuery([ProjectileTag, BodyRef, MeshRef, Life]);
export const projectileSystem = (w = world) => {
  for (const eid of projQuery(w)) {
    Life.ms[eid] -= w.time.delta * 1000;
    if (Life.ms[eid] <= 0) {
      /* remove from world */
      const mesh = meshes[MeshRef.id[eid]] as THREE.Mesh;
      scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();

      rapierWorld.removeRigidBody(bodies[BodyRef.id[eid]]);

      // mark entity dead (simplest: just set life >0 and ignore — real game would remove)
      Life.ms[eid] = 999999;
    }
  }
  return w;
};

/* ────────────────────── render sync ─ */
const meshQuery = defineQuery([MeshRef, Position, Rotation]);
export const renderSystem = (w = world) => {
  for (const eid of meshQuery(w)) {
    const m = meshes[MeshRef.id[eid]];
    m.position.set(Position.x[eid], Position.y[eid], Position.z[eid]);
    m.quaternion.set(Rotation.x[eid], Rotation.y[eid], Rotation.z[eid], Rotation.w[eid]);
  }
  renderer.render(scene, camera);
  return w;
};

/* ────────────────────── pipeline ─ */
export const pipeline = pipe(
  timeSystem,
  pollInput,
  physicsSystem,
  projectileSystem,
  renderSystem
);
