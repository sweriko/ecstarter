import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d';

import { world }          from './ecs/world';
import { pipeline }       from './ecs/systems';
import { createPlayer }   from './ecs/kcc';
import { registerInput }  from './ecs/input';
import { initProjectile } from './ecs/projectile';

/* ─ Three boilerplate ───────────────────────────────────────────── */
export const scene    = new THREE.Scene();
scene.background      = new THREE.Color(0x88bbff);

export const camera   = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1000);
export const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1));
const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(5,10,7);
scene.add(dir);

/* ─ Rapier world ────────────────────────────────────────────────── */
// No need for RAPIER.init() with the ESM version
export const rapierWorld = new RAPIER.World({ x:0, y:-9.81, z:0 });

/* Expose to global scope so `systems.ts` can access without imports */
Object.assign(window as any, { scene, camera, renderer, rapierWorld });

/* ─ Ground plane ────────────────────────────────────────────────── */
{
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(200,200),
    new THREE.MeshStandardMaterial({ color:0x1a5f2a })
  );
  mesh.rotateX(-Math.PI/2);
  scene.add(mesh);

  const body = rapierWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  rapierWorld.createCollider(RAPIER.ColliderDesc.cuboid(100,0.1,100), body);
}

/* ─ Player + systems wiring ─────────────────────────────────────── */
const playerEid = createPlayer(scene, camera);   // kinematic capsule
registerInput(playerEid);                        // WASD, mouse, jump
initProjectile();                                // shooting system

/* ─ Main loop ───────────────────────────────────────────────────── */
function animate() {
  requestAnimationFrame(animate);
  pipeline(world);
}
animate();

/* resize */
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
