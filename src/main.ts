import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d';
import { createWorld, pipe } from 'bitecs';
import { createContext, populateScene } from './ecs/scene';
import { createECS } from './ecs/world';

/* canvas declared in /index.html */
const canvas = document.getElementById('c') as HTMLCanvasElement;

(async () => {
  /* bootstrap Three + Rapier context (physics world still empty) */
  const ctx = await createContext(canvas);

  /* create ECS world & system pipeline */
  const { world, pipeline } = createECS(ctx);

  /* now that ECS exists, spawn cubes & any other scene content */
  populateScene(world, ctx);

  /* MAIN LOOP -------------------------------------------------- */
  const raf = (t: number) => {
    // Calculate delta time in seconds
    world.time.dt = (t - world.time.then) * 0.001;
    world.time.then = t;

    // Run all systems
    pipeline(world);
    
    // Render the scene
    ctx.three.renderer.render(ctx.three.scene, ctx.three.camera);
    
    // Request next frame
    requestAnimationFrame(raf);
  };
  requestAnimationFrame(raf);
})();
