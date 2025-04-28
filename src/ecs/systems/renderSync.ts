/**********************************************************************
 * renderSync.ts – sync Three meshes with Rapier bodies each frame
 *********************************************************************/
import { defineQuery, hasComponent } from 'bitecs';
import { ECS } from '../world';
import {
  MeshRef, RigidBodyRef, Transform, Player
} from '../components';
import { Vector3, Quaternion } from 'three';

export function initRenderSyncSystem(world: ECS) {
  const q = defineQuery([MeshRef]);
  const pos = new Vector3();
  const quat = new Quaternion();
  
  // Storage for previous physics state for interpolation
  const prevPositions = new Map<number, Vector3>();
  const prevRotations = new Map<number, Quaternion>();
  
  // Temp vectors for calculations
  const currentPos = new Vector3();
  const currentRot = new Quaternion();

  return (w: ECS) => {
    // Alpha for interpolation (0.0 to 1.0)
    // On high refresh rates, reduce interpolation amount to prevent perceived blur
    const isHighRefreshRate = w.time.dt < 0.01; // Detecting high refresh (>100Hz)
    const alpha = isHighRefreshRate ? 
                  // Less interpolation on high refresh for sharper image
                  Math.min(0.5, w.time.alpha || 0) :
                  // Standard interpolation on normal refresh
                  (w.time.alpha !== undefined ? w.time.alpha : 0);
    
    for (const eid of q(w)) {
      const mesh = w.ctx.maps.mesh.get(eid)!;
      const rb   = w.ctx.maps.rb.get(eid); // may be undefined

      /* 1. non-player physics objects – physics drives everything ---- */
      if (rb && !hasComponent(w, Player, eid)) {
        const p = rb.translation();
        const r = rb.rotation();
        
        // Set current position/rotation
        currentPos.set(p.x, p.y, p.z);
        currentRot.set(r.x, r.y, r.z, r.w);
        
        // Initialize previous state on first frame
        if (!prevPositions.has(eid)) {
          prevPositions.set(eid, currentPos.clone());
          prevRotations.set(eid, currentRot.clone());
        }
        
        // Get previous state
        const prevPos = prevPositions.get(eid)!;
        const prevRot = prevRotations.get(eid)!;
        
        // Update previous state only when physics runs
        if (w.time.shouldRunPhysics) {
          prevPos.copy(currentPos);
          prevRot.copy(currentRot);
        }
        
        // On fast-moving objects, reduce interpolation to prevent blur
        const vel = rb.linvel ? rb.linvel() : null;
        const isMovingFast = vel && (vel.x*vel.x + vel.y*vel.y + vel.z*vel.z > 100);
        const objectAlpha = isMovingFast && isHighRefreshRate ? 0.3 : alpha;
        
        // Interpolate between previous and current states
        mesh.position.lerpVectors(prevPos, currentPos, objectAlpha);
        mesh.quaternion.slerpQuaternions(prevRot, currentRot, objectAlpha);
        
        continue;
      }

      /* 2. player capsule – physics drives position **only** --------- */
      if (rb && hasComponent(w, Player, eid)) {
        const p = rb.translation();
        
        // Player movement uses same interpolation technique
        currentPos.set(p.x, p.y, p.z);
        
        // Initialize previous state on first frame
        if (!prevPositions.has(eid)) {
          prevPositions.set(eid, currentPos.clone());
        }
        
        // Get previous state
        const prevPos = prevPositions.get(eid)!;
        
        // Update previous state only when physics runs
        if (w.time.shouldRunPhysics) {
          prevPos.copy(currentPos);
        }
        
        // For player, use minimal interpolation on high refresh rate
        const playerAlpha = isHighRefreshRate ? Math.min(0.3, alpha) : alpha;
        
        // Interpolate player position
        mesh.position.lerpVectors(prevPos, currentPos, playerAlpha);
        continue;
      }

      /* 3. kinematic meshes – write transform back into ECS ---------- */
      mesh.getWorldPosition(pos);
      mesh.getWorldQuaternion(quat);

      Transform.x[eid]  = pos.x;
      Transform.y[eid]  = pos.y;
      Transform.z[eid]  = pos.z;
      Transform.qx[eid] = quat.x;
      Transform.qy[eid] = quat.y;
      Transform.qz[eid] = quat.z;
      Transform.qw[eid] = quat.w;
    }
    return w;
  };
}
