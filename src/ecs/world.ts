import { createWorld, pipe } from 'bitecs';
import { initInputSystem, InputState } from './systems/input.js';
import { initPlayerSystem }    from './systems/player.js';
import { initProjectileSystem }from './systems/projectile.js';
import { initPhysicsSystem }   from './systems/physics.js';
import { initRenderSyncSystem }from './systems/renderSync.js';

/** Create ECS world + pipeline */
export function createECS(ctx: ECSContext) {
  const world = createWorld() as ECS;
  world.ctx  = ctx;
  world.time = { dt: 0, then: performance.now() };

  const pipeline = pipe(
    initInputSystem(world),
    initPlayerSystem(world),
    initProjectileSystem(world),
    initPhysicsSystem(world),
    initRenderSyncSystem(world)
  );

  return { world, pipeline };
}

/* -------------------------------------------------- */
/* Types shared with scene & systems                  */
export type ECS = ReturnType<typeof createWorld> & {
  ctx:  ECSContext;
  time: { dt: number; then: number };
  input?: InputState;
};

export interface ECSContext {
  rapier:   typeof import('@dimforge/rapier3d');
  physics:  import('@dimforge/rapier3d').World;
  three: {
    scene:    THREE.Scene;
    camera:   THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
  };
  maps: {
    mesh: Map<number, THREE.Object3D>;
    rb:   Map<number, import('@dimforge/rapier3d').RigidBody>;
  };
}
