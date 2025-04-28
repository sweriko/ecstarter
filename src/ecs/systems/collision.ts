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
  const processedCollisions = new Map<string, number>();
  
  return (w: ECS) => {
    const now = performance.now();
    
    // Clean up old processed collisions (older than 200ms)
    for (const [key, time] of processedCollisions.entries()) {
      if (now - time > 200) {
        processedCollisions.delete(key);
      }
    }
    
    // Process projectile-cube collisions using raycasting
    for (const projectileEid of projectileQuery(w)) {
      const projectileRB = w.ctx.maps.rb.get(projectileEid);
      if (!projectileRB) continue;
      
      // Get projectile position and velocity
      const pos = projectileRB.translation();
      const vel = projectileRB.linvel();
      
      // Skip if velocity is very small
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y + vel.z * vel.z);
      if (speed < 0.1) continue;
      
      // Create a ray from current position in velocity direction
      const currentPos = new THREE.Vector3(pos.x, pos.y, pos.z);
      const direction = new THREE.Vector3(vel.x, vel.y, vel.z).normalize();
      
      // Use a velocity-scaled distance for the raycast
      const rayDistance = speed * w.time.dt * 1.5; // Add some margin
      
      // Create the raycaster
      const raycaster = new THREE.Raycaster(currentPos, direction, 0, rayDistance);
      
      // Check against all cube meshes
      const cubeMeshes: Array<{eid: number, mesh: THREE.Object3D}> = [];
      for (const cubeEid of cubeQuery(w)) {
        const mesh = w.ctx.maps.mesh.get(cubeEid);
        if (mesh) cubeMeshes.push({ eid: cubeEid, mesh });
      }
      
      // Perform the raycast against meshes
      const intersects = raycaster.intersectObjects(
        cubeMeshes.map(item => item.mesh), 
        false
      );
      
      if (intersects.length > 0) {
        // Get the hit cube
        const hitObject = intersects[0].object;
        const cubeInfo = cubeMeshes.find(item => item.mesh === hitObject);
        
        if (cubeInfo) {
          const cubeEid = cubeInfo.eid;
          
          // Create a unique ID for this collision
          const collisionId = `${projectileEid}-${cubeEid}-${Math.floor(now / 100)}`;
          
          // Skip if we've already processed this collision recently
          if (processedCollisions.has(collisionId)) continue;
          
          // Mark collision as processed
          processedCollisions.set(collisionId, now);
          
          // Get the cube rigid body
          const cubeRB = w.ctx.maps.rb.get(cubeEid);
          if (!cubeRB) continue;
          
          // Apply impulse force
          cubeRB.applyImpulse(
            { 
              x: direction.x * IMPACT_FORCE, 
              y: direction.y * IMPACT_FORCE, 
              z: direction.z * IMPACT_FORCE 
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
          
          // Mark projectile for destruction (but don't destroy here, let projectile system do it)
          // This improves performance by separating collision detection from entity removal
          markEntityForDeletion(projectileEid);
        }
      }
    }
    
    return w;
  };
  
  // Helper function to mark projectiles for deletion without immediately destroying them
  function markEntityForDeletion(eid: number) {
    // We're just setting a flag on the entity that the projectile system will check
    const mesh = world.ctx.maps.mesh.get(eid);
    if (mesh) {
      // We'll use a custom user data property to mark for deletion
      if (!mesh.userData) mesh.userData = {};
      mesh.userData.markedForDeletion = true;
    }
  }
} 