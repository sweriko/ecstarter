import { defineQuery, exitQuery } from 'bitecs';
import { RigidBodyRef } from '../components';
import { ECS } from '../world';

export function initPhysicsSystem(world: ECS) {
  const rbq = defineQuery([RigidBodyRef]);
  const exit = exitQuery(rbq);

  /* cleanup on entity removal */
  return (w: ECS) => {
    w.ctx.physics.step();

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
