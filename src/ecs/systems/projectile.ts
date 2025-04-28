import { defineQuery, removeEntity } from 'bitecs';
import { Lifespan, Projectile, RigidBodyRef } from '../components';
import { ECS } from '../world';
import * as THREE from 'three';

export function initProjectileSystem(world: ECS) {
  const q = defineQuery([Projectile, Lifespan]);

  return (w: ECS) => {
    const now = performance.now();
    for (const eid of q(w)) {
      if (now - Lifespan.born[eid] > Lifespan.ttl[eid]) {
        /* despawn */
        const mesh = w.ctx.maps.mesh.get(eid) as THREE.Mesh;
        if (mesh) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); mesh.removeFromParent(); }
        const rb = w.ctx.maps.rb.get(eid);
        if (rb) w.ctx.physics.removeRigidBody(rb);
        w.ctx.maps.mesh.delete(eid);
        w.ctx.maps.rb.delete(eid);
        removeEntity(w, eid);
      }
    }
    return w;
  };
}
