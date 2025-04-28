import { ECS } from '../world';

// Fixed timestep configuration
const FIXED_DT = 1/60; // 60 updates per second for physics
const MAX_FRAME_TIME = 0.25; // Maximum time to spend catching up (prevents spiral of death)

export function initTimeStepSystem(world: ECS) {
  // Initialize time state in world
  world.time.accumulator = 0;
  
  return function timeStepSystem(world: ECS) {
    // Cap deltaTime to prevent spiral of death when tab is inactive
    const cappedDt = Math.min(world.time.dt, MAX_FRAME_TIME);
    
    // Add frame's delta time to accumulator
    world.time.accumulator += cappedDt;
    
    // Reset physics step flag each frame
    world.time.shouldRunPhysics = false;
    world.time.physicsSteps = 0;
    
    // Run fixed physics steps if enough time has accumulated
    while (world.time.accumulator >= FIXED_DT) {
      world.time.shouldRunPhysics = true;
      world.time.fixedDt = FIXED_DT;
      world.time.physicsSteps++;
      world.time.accumulator -= FIXED_DT;
    }
    
    // Calculate alpha for interpolation (0.0 to 1.0)
    world.time.alpha = world.time.accumulator / FIXED_DT;
    
    return world;
  };
} 