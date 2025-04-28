import { createWorld, pipe } from 'bitecs';
import { initInputSystem, InputState } from './systems/input.ts';
import { initPlayerSystem }    from './systems/player.ts';
import { initProjectileSystem }from './systems/projectile.ts';
import { initPhysicsSystem }   from './systems/physics.ts';
import { initRenderSyncSystem }from './systems/renderSync.ts';
import { initDebugVisSystem }  from './systems/debugVis.ts';
import { initCollisionSystem } from './systems/collision.ts';

/** Create ECS world + pipeline */
export function createECS(ctx: ECSContext) {
  const world = createWorld() as ECS;
  world.ctx  = ctx;
  world.time = { dt: 0, then: performance.now() };

  const pipeline = pipe(
    initInputSystem(world),
    initPlayerSystem(world),
    initCollisionSystem(world),  // Process collisions before projectiles
    initProjectileSystem(world),
    initPhysicsSystem(world),
    initDebugVisSystem(world),   // Debug visualization after physics update
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
