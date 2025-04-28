import { defineQuery, addComponent, addEntity, hasComponent } from 'bitecs';
import { DebugVis, Projectile, Player, RigidBodyRef, DebugMeshRef, Trajectory } from '../components';
import { ECS } from '../world';
import * as THREE from 'three';

export function initDebugVisSystem(world: ECS) {
  const debugQuery = defineQuery([DebugVis]);
  const playerQuery = defineQuery([Player, RigidBodyRef]);
  const projectileQuery = defineQuery([Projectile, RigidBodyRef]);
  
  // Create debug visualization elements
  const debugMeshes = new Map<number, THREE.Object3D>();
  const trajectoryLines = new Map<number, THREE.Line>();
  
  // Store history of positions for trajectories
  const trajectories = new Map<number, THREE.Vector3[]>();
  
  // Create player capsule mesh for debug
  let playerCapsule: THREE.Mesh | null = null;
  
  return (w: ECS) => {
    // First check if debug visualization is enabled
    const debugEnts = debugQuery(w);
    const debugId = debugEnts.length > 0 ? debugEnts[0] : -1;
    const debugActive = debugId !== -1 && DebugVis.active[debugId] === 1;
    
    // Initialize player debug capsule if needed
    if (!playerCapsule) {
      // Create a capsule mesh
      const capsuleGeometry = createCapsuleGeometry(0.3, 1.8, 16, 8);
      const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ffff,
        wireframe: true,
        transparent: true,
        opacity: 0.7
      });
      playerCapsule = new THREE.Mesh(capsuleGeometry, wireframeMaterial);
      w.ctx.three.scene.add(playerCapsule);
      playerCapsule.visible = false; // Hidden by default
    }
    
    // Update player capsule visibility
    if (playerCapsule) {
      playerCapsule.visible = debugActive;
      
      // Update position if visible
      if (debugActive) {
        const playerEnts = playerQuery(w);
        if (playerEnts.length > 0) {
          const playerEid = playerEnts[0];
          const playerObj = w.ctx.maps.mesh.get(playerEid);
          if (playerObj) {
            playerCapsule.position.copy(playerObj.position);
            playerCapsule.position.y -= 0.3; // Adjust to match center of capsule
            playerCapsule.rotation.y = playerObj.rotation.y;
          }
        }
      }
    }
    
    // Update projectile trajectories
    for (const projectileEid of projectileQuery(w)) {
      // Get current position for this projectile
      const rb = w.ctx.maps.rb.get(projectileEid);
      if (!rb) continue;
      
      // Initialize trajectory if needed
      if (!trajectories.has(projectileEid)) {
        trajectories.set(projectileEid, []);
      }
      
      // Get position and add to trajectory
      const pos = rb.translation();
      const currentPos = new THREE.Vector3(pos.x, pos.y, pos.z);
      
      // Add current position to trajectory and limit length
      const trajectory = trajectories.get(projectileEid)!;
      trajectory.push(currentPos.clone());
      
      if (trajectory.length > 100) {
        trajectory.shift();
      }
      
      // Only update/show trajectory lines if debug is active
      if (debugActive) {
        if (trajectoryLines.has(projectileEid)) {
          // Update existing line
          const line = trajectoryLines.get(projectileEid)!;
          line.visible = true;
          line.geometry.dispose();
          line.geometry = new THREE.BufferGeometry().setFromPoints(trajectory);
        } else {
          // Create new line
          const material = new THREE.LineBasicMaterial({ 
            color: 0xff9900, 
            transparent: true, 
            opacity: 0.7 
          });
          const geometry = new THREE.BufferGeometry().setFromPoints(trajectory);
          const line = new THREE.Line(geometry, material);
          trajectoryLines.set(projectileEid, line);
          w.ctx.three.scene.add(line);
        }
      } else {
        // Hide lines if debug is disabled
        if (trajectoryLines.has(projectileEid)) {
          trajectoryLines.get(projectileEid)!.visible = false;
        }
      }
    }
    
    // Clean up trajectories for removed projectiles
    for (const [eid, line] of trajectoryLines.entries()) {
      const projectileExists = projectileQuery(w).includes(eid);
      
      // Check if projectile is marked for deletion
      const mesh = w.ctx.maps.mesh.get(eid);
      const markedForDeletion = mesh?.userData?.markedForDeletion === true;
      
      if (!projectileExists || markedForDeletion) {
        // Remove the trajectory line
        w.ctx.three.scene.remove(line);
        line.geometry.dispose();
        if (line.material instanceof THREE.Material) {
          line.material.dispose();
        }
        trajectoryLines.delete(eid);
        trajectories.delete(eid);
      }
    }
    
    return w;
  };
}

// Create a capsule geometry (cylinder with hemispheres at ends)
function createCapsuleGeometry(radius: number, height: number, widthSegments = 16, heightSegments = 8): THREE.BufferGeometry {
  // Calculate half height (cylinder height without the spherical caps)
  const halfHeight = height / 2 - radius;
  
  // Create cylinder body
  const cylinderGeometry = new THREE.CylinderGeometry(
    radius, radius, height - radius * 2, widthSegments, 1, true
  );
  
  // Create top hemisphere
  const topSphereGeometry = new THREE.SphereGeometry(
    radius, widthSegments, heightSegments, 0, Math.PI * 2, 0, Math.PI / 2
  );
  topSphereGeometry.translate(0, halfHeight, 0);
  
  // Create bottom hemisphere
  const bottomSphereGeometry = new THREE.SphereGeometry(
    radius, widthSegments, heightSegments, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2
  );
  bottomSphereGeometry.translate(0, -halfHeight, 0);
  
  // For simplicity we'll just use the cylinder geometry
  // A proper implementation would merge these three geometries
  return cylinderGeometry;
} 