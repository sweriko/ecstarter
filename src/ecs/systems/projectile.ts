import { defineQuery, removeEntity } from 'bitecs';
import { Lifespan, Projectile, RigidBodyRef } from '../components';
import { ECS } from '../world';
import * as THREE from 'three';

export function initProjectileSystem(world: ECS) {
  const projectileQuery = defineQuery([Projectile, Lifespan]);
  
  return (w: ECS) => {
    const now = performance.now();
    
    // Create a list of entities to remove to avoid modifying during iteration
    const entitiesToRemove: number[] = [];
    
    // Process bullet lifetimes and handle destruction
    for (const eid of projectileQuery(w)) {
      // Skip processing if already marked for removal
      if (entitiesToRemove.includes(eid)) continue;
      
      // Get rigid body reference
      const rb = w.ctx.maps.rb.get(eid);
      if (!rb) {
        // Body reference invalid, mark for removal
        entitiesToRemove.push(eid);
        continue;
      }
      
      // Skip if body is no longer valid (prevents "unreachable" errors)
      try {
        // Just check if we can access a property - will throw if body is invalid
        const _ = rb.handle;
      } catch (error) {
        // Something's wrong with this rigid body, mark for removal
        console.warn("Invalid rigid body detected, removing entity", eid);
        entitiesToRemove.push(eid);
        continue;
      }
      
      // Check if bullet should be removed due to lifetime
      const expired = now - Lifespan.born[eid] > Lifespan.ttl[eid];
      
      // Check if bullet was marked for deletion by collision system
      const mesh = w.ctx.maps.mesh.get(eid);
      const markedForDeletion = mesh?.userData?.markedForDeletion === true;
      
      // Mark for removal if expired or deletion requested
      if (expired || markedForDeletion) {
        entitiesToRemove.push(eid);
      }
    }
    
    // Perform entity removal outside of query iteration
    for (const eid of entitiesToRemove) {
      // Clean up mesh
      const mesh = w.ctx.maps.mesh.get(eid);
      if (mesh) {
        // Cast to Three.js Mesh to access geometry and material
        const threeMesh = mesh as THREE.Mesh;
        if (threeMesh.geometry) {
          threeMesh.geometry.dispose();
        }
        
        if (threeMesh.material) {
          if (threeMesh.material instanceof THREE.Material) {
            threeMesh.material.dispose();
          } else if (Array.isArray(threeMesh.material)) {
            for (const material of threeMesh.material) {
              material.dispose();
            }
          }
        }
        
        mesh.removeFromParent();
      }
      
      // Clean up physics body
      try {
        const rb = w.ctx.maps.rb.get(eid);
        if (rb) {
          // Make sure we're not trying to remove a rigid body that's already gone
          try {
            // Check if the body is still valid
            const _ = rb.handle;
            // If we get here, it's safe to remove
            w.ctx.physics.removeRigidBody(rb);
          } catch (error) {
            // Body is already invalid, just skip removal
            console.warn("Skipping invalid rigid body removal", error);
          }
        }
      } catch (error) {
        console.warn("Error removing rigid body", error);
      }
      
      // Remove references
      w.ctx.maps.mesh.delete(eid);
      w.ctx.maps.rb.delete(eid);
      
      // Remove entity from ECS world
      removeEntity(w, eid);
    }
    
    return w;
  };
}
