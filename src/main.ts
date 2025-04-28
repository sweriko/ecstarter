import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d';
import { createWorld, pipe } from 'bitecs';
import { createContext, populateScene } from './ecs/scene';
import { createECS } from './ecs/world';
import Stats from 'three/examples/jsm/libs/stats.module.js';

/* canvas declared in /index.html */
const canvas = document.getElementById('c') as HTMLCanvasElement;

(async () => {
  /* bootstrap Three + Rapier context (physics world still empty) */
  const ctx = await createContext(canvas);

  /* create ECS world & system pipeline */
  const { world, pipeline } = createECS(ctx);

  /* now that ECS exists, spawn cubes & any other scene content */
  populateScene(world, ctx);
  
  /* Setup Stats.js performance monitor */
  const stats = new Stats();
  stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3+: custom
  stats.dom.style.position = 'absolute';
  stats.dom.style.left = '0px';
  stats.dom.style.top = '0px';
  document.body.appendChild(stats.dom);

  /* MAIN LOOP -------------------------------------------------- */
  const raf = (t: number) => {
    // Begin stats measurement
    stats.begin();
    
    // Calculate delta time in seconds
    const now = performance.now();
    // Use a minimum delta time to prevent tiny stutters during fast displays 
    const minDt = 1/240; // Minimum sensible delta (240Hz)
    world.time.dt = Math.max(minDt, (now - world.time.then) * 0.001); // Convert ms to seconds
    world.time.then = now;

    // Run all systems
    pipeline(world);
    
    // Render the scene
    ctx.three.renderer.render(ctx.three.scene, ctx.three.camera);
    
    // End stats measurement
    stats.end();
    
    // Request next frame
    requestAnimationFrame(raf);
  };
  
  // Start the loop
  world.time.then = performance.now();
  requestAnimationFrame(raf);
})();
