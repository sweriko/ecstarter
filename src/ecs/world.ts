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
  
  // Create a collision event queue for Rapier
  const eventQueue = new ctx.rapier.EventQueue(true);
  world.ctx.eventQueue = eventQueue;

  const pipeline = pipe(
    initInputSystem(world),
    initPlayerSystem(world),
    initPhysicsSystem(world),   // Physics runs before collision system to process contacts
    initCollisionSystem(world), // Now handles Rapier collision events instead of raycasting
    initProjectileSystem(world),
    initDebugVisSystem(world),
    initRenderSyncSystem(world)
  );

  return { world, pipeline };
}

/* -------------------------------------------------- */
/* Types shared with scene & systems                  */
export interface ECSContext {
  rapier: any;
  physics: any;
  three: any;
  maps: {
    rb: Map<number, any>;
    mesh: Map<number, any>;
  };
  eventQueue?: any; // Added for collision detection
}

export interface ECS {
  ctx: ECSContext;
  time: {
    dt: number;
    then: number;
  };
  input?: any;
}
