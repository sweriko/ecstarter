import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d';
import {
  addEntity, addComponent, defineQuery
} from 'bitecs';
import { world, meshes, bodies, kccs } from './world';
import {
  Position, Rotation, MeshRef, BodyRef, KccRef,
  MoveDir, LookDir, JumpReq, ShootReq,
  PlayerTag
} from './components';
import { shootProjectile } from './projectile';

declare const rapierWorld: RAPIER.World;
declare const camera: THREE.PerspectiveCamera;

/* constants */
const MOVE_SPEED   = 7;
const JUMP_SPEED   = 7;
const MOUSE_SENS   = 0.002;
const CAMERA_OFFSET= new THREE.Vector3(0,1.4,0);

export function createPlayer(scene: THREE.Scene, cam: THREE.Camera) {
  const eid = addEntity(world);
  addComponent(world, PlayerTag, eid);
  addComponent(world, Position, eid);
  addComponent(world, Rotation, eid);
  addComponent(world, MoveDir,  eid);
  addComponent(world, LookDir,  eid);
  addComponent(world, JumpReq,  eid);
  addComponent(world, ShootReq, eid);

  /* Three mesh */
  const mesh = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4,1.2,8,16),
    new THREE.MeshStandardMaterial({color:0x6699ff})
  );
  scene.add(mesh);
  meshes.push(mesh);
  addComponent(world, MeshRef, eid);
  MeshRef.id[eid] = meshes.length-1;

  /* Rapier kinematic body */
  const rb = rapierWorld.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased()
                                .setTranslation(0,3,0).setCcdEnabled(true));
  rapierWorld.createCollider(RAPIER.ColliderDesc.capsule(0.6,0.2), rb);
  bodies.push(rb);
  addComponent(world, BodyRef, eid);
  BodyRef.id[eid] = bodies.length-1;

  /* Character controller helper */
  const kcc = rapierWorld.createCharacterController(0.01);
  kcc.setApplyImpulsesToDynamicBodies(true);
  kccs.push(kcc);
  addComponent(world, KccRef, eid);
  KccRef.id[eid] = kccs.length-1;

  /* ---------- system to drive this player ---------- */
  const q = defineQuery([PlayerTag, BodyRef, KccRef, MoveDir, LookDir, JumpReq, ShootReq]);
  world.playerSystem = (dt:number) => {
    for (const id of q(world)) {
      const body = bodies[BodyRef.id[id]];
      const ctrl = kccs[KccRef.id[id]];

      /* mouse-look */
      const yaw   = -LookDir.dx[id]*MOUSE_SENS;
      const pitch = -LookDir.dy[id]*MOUSE_SENS;

      LookDir.dx[id]=0; LookDir.dy[id]=0;

      // rotate body around Y
      const rot = body.rotation();
      const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0), yaw);
      const qPitch= new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0), pitch);
      const bodyQuat = new THREE.Quaternion(rot.x,rot.y,rot.z,rot.w);
      bodyQuat.multiply(qYaw);
      body.setNextKinematicRotation({x:bodyQuat.x,y:bodyQuat.y,z:bodyQuat.z,w:bodyQuat.w});

      // camera pitch is local to body
      const cameraQuat = qPitch.multiply(camera.quaternion);
      camera.quaternion.copy(cameraQuat);

      /* movement */
      const dir = new THREE.Vector3(MoveDir.x[id],0,MoveDir.z[id]);
      dir.applyQuaternion(bodyQuat).multiplyScalar(MOVE_SPEED);

      let velY = body.linvel().y;
      /* jump */
      if (JumpReq.value[id] && ctrl.computedGrounded()) velY = JUMP_SPEED;
      JumpReq.value[id]=0;

      const desired = {x:dir.x*dt, y:velY*dt, z:dir.z*dt};
      ctrl.computeColliderMovement(body.collider(0), desired);
      const mv = ctrl.computedMovement();
      const newPos = body.translation();
      body.setNextKinematicTranslation({
        x:newPos.x+mv.x, y:newPos.y+mv.y, z:newPos.z+mv.z
      });

      /* camera follow */
      camera.position.set(
        newPos.x+mv.x+CAMERA_OFFSET.x,
        newPos.y+mv.y+CAMERA_OFFSET.y,
        newPos.z+mv.z+CAMERA_OFFSET.z
      );

      /* shooting */
      if (ShootReq.value[id]) {
        shootProjectile(camera);
        ShootReq.value[id]=0;
      }
    }
  };

  return eid;
}

/* run each frame – called from projectile.init */
export function updatePlayer(dt:number){ world.playerSystem?.(dt); }
