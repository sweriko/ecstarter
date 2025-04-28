import { defineQuery } from 'bitecs';
import { MeshRef, RigidBodyRef, Transform } from '../components';
import { ECS } from '../world';
import { Quaternion, Vector3 } from 'three';

export function initRenderSyncSystem(world: ECS) {
  const q = defineQuery([Transform, MeshRef]);

  const pos = new Vector3();
  const quat = new Quaternion();

  return (w: ECS) => {
    /* sync mesh → rigidBody OR rigidBody → mesh */
    for (const eid of q(w)) {
      const mesh = w.ctx.maps.mesh.get(eid)!;
      const rb   = w.ctx.maps.rb.get(eid);

      if (rb) { // physics drives visual
        const p = rb.translation();
        const r = rb.rotation();
        mesh.position.set(p.x,p.y,p.z);
        mesh.quaternion.set(r.x,r.y,r.z,r.w);
      } else {  // kinematic visual drives physics (player)
        mesh.getWorldPosition(pos);
        mesh.getWorldQuaternion(quat);

        Transform.x[eid] = pos.x;
        Transform.y[eid] = pos.y;
        Transform.z[eid] = pos.z;
        Transform.qx[eid]= quat.x;
        Transform.qy[eid]= quat.y;
        Transform.qz[eid]= quat.z;
        Transform.qw[eid]= quat.w;
      }
    }
    return w;
  };
}
