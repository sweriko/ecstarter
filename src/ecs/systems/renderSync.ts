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

  return (w: ECS) => {
    for (const eid of q(w)) {
      const mesh = w.ctx.maps.mesh.get(eid)!;
      const rb   = w.ctx.maps.rb.get(eid); // may be undefined

      /* 1. non-player physics objects – physics drives everything ---- */
      if (rb && !hasComponent(w, Player, eid)) {
        const p = rb.translation();
        const r = rb.rotation();
        mesh.position.set(p.x, p.y, p.z);
        mesh.quaternion.set(r.x, r.y, r.z, r.w);
        continue;
      }

      /* 2. player capsule – physics drives position **only** --------- */
      if (rb && hasComponent(w, Player, eid)) {
        const p = rb.translation();
        mesh.position.set(p.x, p.y, p.z);
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
