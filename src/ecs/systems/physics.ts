import { defineQuery, exitQuery } from 'bitecs';
import { RigidBodyRef } from '../components';
import { ECS } from '../world';

export function initPhysicsSystem(world: ECS) {
  const rbq = defineQuery([RigidBodyRef]);
  const exit = exitQuery(rbq);

  // Physics configuration - can be adjusted for performance vs accuracy
  const PHYSICS_SOLVER_ITERATIONS = 4; // More iterations for better stability
  const PHYSICS_CCD_SUBSTEPS = 4; // Increase CCD substeps for better bullet collisions
  const PHYSICS_VELOCITY_THRESHOLD = 30.0; // Velocity magnitude threshold for enabling CCD

  /* cleanup on entity removal */
  return (w: ECS) => {
    // Skip physics if we're not on a physics frame
    if (!w.time.shouldRunPhysics) {
      return w;
    }
    
    // Get all active rigid bodies
    const rigidBodies = [];
    for (const eid of rbq(w)) {
      const rb = w.ctx.maps.rb.get(eid);
      if (rb) rigidBodies.push(rb);
    }
    
    // Dynamically enable CCD on fast-moving objects
    for (const rb of rigidBodies) {
      try {
        // Different versions of Rapier have different APIs
        // Check if the body is dynamic (only dynamic bodies can have CCD)
        const isDynamic = rb.bodyType && 
                         rb.bodyType() === w.ctx.rapier.RigidBodyType.Dynamic;
        
        if (isDynamic) {
          const vel = rb.linvel();
          const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
          
          // Enable CCD for fast moving objects 
          // Check if this version of Rapier supports CCD toggling
          if (speed > PHYSICS_VELOCITY_THRESHOLD && rb.enableCcd) {
            rb.enableCcd(true);
          } 
          // Disable CCD for slower objects to improve performance
          else if (speed < PHYSICS_VELOCITY_THRESHOLD * 0.8 && rb.enableCcd) {
            rb.enableCcd(false);
          }
        }
      } catch (e) {
        // Skip CCD handling if the API doesn't match
      }
    }
    
    // Configure physics parameters if the API supports it
    try {
      if (w.ctx.physics.integrationParameters) {
        // Set solver iterations for more accurate simulation
        w.ctx.physics.integrationParameters.numSolverIterations = PHYSICS_SOLVER_ITERATIONS;
        
        // Increase CCD substeps - critical for bullet physics!
        w.ctx.physics.integrationParameters.maxCcdSubsteps = PHYSICS_CCD_SUBSTEPS;
      }
    } catch (e) {
      // Skip if the API doesn't support this
    }
    
    // Always use the fixed timestep from the time system
    const dt = w.time.fixedDt || (1/60);
    
    // Process physics step with fixed timestep
    if (w.ctx.eventQueue) {
      w.ctx.physics.step(w.ctx.eventQueue, dt);
    } else {
      w.ctx.physics.step(dt);
    }

    /* purge removed RigidBodies */
    for (const eid of exit(w)) {
      const rb = w.ctx.maps.rb.get(eid);
      if (rb) {
        w.ctx.physics.removeRigidBody(rb);
        w.ctx.maps.rb.delete(eid);
      }
    }
    return w;
  };
}
