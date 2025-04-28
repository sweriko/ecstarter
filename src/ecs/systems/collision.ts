import { defineQuery, addComponent, addEntity } from 'bitecs';
import { Projectile, CubeTag, RigidBodyRef, CollisionEvent } from '../components';
import { ECS } from '../world';
import * as THREE from 'three';

export function initCollisionSystem(world: ECS) {
  const projectileQuery = defineQuery([Projectile, RigidBodyRef]);
  const cubeQuery = defineQuery([CubeTag, RigidBodyRef]);
  
  // Impact force when bullet hits cube
  const IMPACT_FORCE = 20.0;
  
  // Last processed collision time to avoid duplicates 
  // Still useful for physics-based collisions to avoid duplicate events
  const processedCollisions = new Map<string, number>();
  
  return (w: ECS) => {
    const now = performance.now();
    
    // Clean up old processed collisions (older than 200ms)
    for (const [key, time] of processedCollisions.entries()) {
      if (now - time > 200) {
        processedCollisions.delete(key);
      }
    }
    
    // Skip if no event queue is available
    if (!w.ctx.eventQueue) {
      return w;
    }
    
    // Build lookup maps for entity IDs by rigid body handle
    const rbHandleToEntityMap = new Map();
    const entityTypeMap = new Map();
    
    // Get all projectiles and their rigidbody handles
    for (const eid of projectileQuery(w)) {
      const rb = w.ctx.maps.rb.get(eid);
      if (rb) {
        rbHandleToEntityMap.set(rb.handle, eid);
        entityTypeMap.set(eid, 'projectile');
      }
    }
    
    // Get all cubes and their rigidbody handles
    for (const eid of cubeQuery(w)) {
      const rb = w.ctx.maps.rb.get(eid);
      if (rb) {
        rbHandleToEntityMap.set(rb.handle, eid);
        entityTypeMap.set(eid, 'cube');
      }
    }
    
    // Process collision events from Rapier physics
    w.ctx.eventQueue.drainCollisionEvents((handle1: number, handle2: number, started: boolean) => {
      // We only care about collision starts
      if (!started) return;
      
      // Get entity IDs from rigid body handles
      const entity1 = rbHandleToEntityMap.get(handle1);
      const entity2 = rbHandleToEntityMap.get(handle2);
      
      if (!entity1 || !entity2) return;
      
      // Check if one is a projectile and one is a cube
      const entity1Type = entityTypeMap.get(entity1);
      const entity2Type = entityTypeMap.get(entity2);
      
      // Skip if not a projectile-cube collision
      if (!((entity1Type === 'projectile' && entity2Type === 'cube') || 
           (entity1Type === 'cube' && entity2Type === 'projectile'))) {
        return;
      }
      
      // Determine which is which
      const projectileEid = entity1Type === 'projectile' ? entity1 : entity2;
      const cubeEid = entity1Type === 'cube' ? entity1 : entity2;
      
      // Create a unique ID for this collision
      const collisionId = `${projectileEid}-${cubeEid}-${Math.floor(now / 100)}`;
      
      // Skip if we've already processed this collision recently
      if (processedCollisions.has(collisionId)) return;
      
      // Mark collision as processed
      processedCollisions.set(collisionId, now);
      
      // Get the cube and projectile rigid bodies
      const cubeRB = w.ctx.maps.rb.get(cubeEid);
      const projectileRB = w.ctx.maps.rb.get(projectileEid);
      
      if (!cubeRB || !projectileRB) return;
      
      // Calculate impact direction - from bullet to cube center
      const bulletPos = projectileRB.translation();
      const cubePos = cubeRB.translation();
      
      // Direction vector from bullet to cube center (where to push the cube)
      const impactDir = new THREE.Vector3(
        cubePos.x - bulletPos.x,
        cubePos.y - bulletPos.y,
        cubePos.z - bulletPos.z
      ).normalize();
      
      // If direction is zero (e.g., direct center hit), use reversed bullet velocity
      if (impactDir.lengthSq() < 0.001) {
        const vel = projectileRB.linvel();
        impactDir.set(-vel.x, -vel.y, -vel.z).normalize();
      }
      
      // Apply impulse force at contact point in direction from bullet to cube
      cubeRB.applyImpulseAtPoint(
        { 
          x: impactDir.x * IMPACT_FORCE, 
          y: impactDir.y * IMPACT_FORCE, 
          z: impactDir.z * IMPACT_FORCE 
        },
        {
          x: bulletPos.x,
          y: bulletPos.y,
          z: bulletPos.z
        },
        true
      );
      
      // Add some random torque for realistic effect
      cubeRB.applyTorqueImpulse(
        {
          x: (Math.random() - 0.5) * IMPACT_FORCE * 0.3,
          y: (Math.random() - 0.5) * IMPACT_FORCE * 0.3,
          z: (Math.random() - 0.5) * IMPACT_FORCE * 0.3
        },
        true
      );
      
      // Create a collision event entity
      const eventEid = addEntity(w);
      addComponent(w, CollisionEvent, eventEid);
      CollisionEvent.entity1[eventEid] = projectileEid;
      CollisionEvent.entity2[eventEid] = cubeEid;
      CollisionEvent.impulse[eventEid] = IMPACT_FORCE;
      CollisionEvent.time[eventEid] = now;
      
      // Mark projectile for destruction
      markEntityForDeletion(projectileEid);
    });
    
    return w;
  };
  
  // Helper function to mark projectiles for deletion
  function markEntityForDeletion(eid: number) {
    const mesh = world.ctx.maps.mesh.get(eid);
    if (mesh) {
      if (!mesh.userData) mesh.userData = {};
      mesh.userData.markedForDeletion = true;
    }
  }
} 