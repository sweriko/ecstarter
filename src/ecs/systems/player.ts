/**********************************************************************
 * player.ts – first-person controller (movement + shooting)
 *********************************************************************/
import { addComponent, addEntity } from 'bitecs';
import * as THREE from 'three';
import {
  MeshRef, Player, RigidBodyRef, Transform,
  Projectile, Lifespan, Velocity
} from '../components';
import { ECS } from '../world';
import { InputState } from './input.js';

/* constants -------------------------------------------------------- */
const WALK_SPEED     = 8;
const SPRINT_FACTOR  = 1.8;
const AIR_CONTROL    = 0.7;
const JUMP_VEL       = 10;
const GRAVITY        = 20;
const TERMINAL_FALL  = -20;

const JUMP_CD_MS     = 300;
const COYOTE_MS      = 150;
const SHOOT_CD_MS    = 200;
const BULLET_SPEED   = 40;
const BULLET_TTL_MS  = 5000;

enum MoveState { GROUNDED, JUMPING, FALLING }

/* ------------------------------------------------------------------ */
export function initPlayerSystem(world: ECS) {
  const { rapier, physics, three, maps } = world.ctx;

  /* entity + mesh holder ------------------------------------------- */
  const pid = addEntity(world);
  addComponent(world, Player,       pid);
  addComponent(world, Transform,    pid);
  addComponent(world, MeshRef,      pid);
  addComponent(world, RigidBodyRef, pid);

  const holder = new THREE.Object3D();
  holder.position.set(0, 3, 6);
  holder.add(three.camera);
  three.scene.add(holder);
  maps.mesh.set(pid, holder);

  /* Rapier kinematic capsule --------------------------------------- */
  const rb = physics.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
          .setTranslation(holder.position.x, holder.position.y, holder.position.z)
          .setCcdEnabled(true)
  );
  const collider = physics.createCollider(
    rapier.ColliderDesc.capsule(0.9, 0.3).setFriction(0.2), rb
  );

  const kcc = physics.createCharacterController(0.01);
  kcc.setApplyImpulsesToDynamicBodies(true);
  kcc.setUp({ x: 0, y: 1, z: 0 });
  kcc.enableAutostep(0.5, 0.3, true);
  kcc.enableSnapToGround(0.3);

  maps.rb.set(pid, rb);
  RigidBodyRef.id[pid] = rb.handle;

  /* runtime state -------------------------------------------------- */
  let pitch = 0;
  let vertVel = 0;
  let moveState: MoveState = MoveState.GROUNDED;
  let lastGrounded = 0, lastJump = 0, lastShot = 0;
  let prevShoot = false;

  const dir = new THREE.Vector3();
  const horiz = new THREE.Vector2();

  /* system --------------------------------------------------------- */
  return (w: ECS) => {
    const input = w.input as InputState;
    if (!input) return w;

    /* mouse-look ---------------------------------------------------- */
    if (input.pointerLocked) {
      holder.rotation.y = (holder.rotation.y - input.dx * 0.002) % (Math.PI * 2);
      if (holder.rotation.y < 0) holder.rotation.y += Math.PI * 2;

      pitch = THREE.MathUtils.clamp(pitch - input.dy * 0.002, -Math.PI / 2, Math.PI / 2);
      three.camera.rotation.x = pitch;
    }
    input.dx = input.dy = 0;

    /* movement state + gravity ------------------------------------- */
    const now = performance.now();
    const grounded = kcc.computedGrounded();
    if (grounded) lastGrounded = now;

    moveState =
      grounded ? MoveState.GROUNDED :
      (vertVel > 0 ? MoveState.JUMPING : MoveState.FALLING);

    if (input.jump &&
        (grounded || now - lastGrounded < COYOTE_MS) &&
        now - lastJump > JUMP_CD_MS) {
      vertVel = JUMP_VEL;
      lastJump = now;
    }

    if (moveState !== MoveState.GROUNDED) {
      vertVel = Math.max(vertVel - GRAVITY * w.time.dt, TERMINAL_FALL);
    } else {
      vertVel *= 0.8;
      if (Math.abs(vertVel) < 0.1) vertVel = 0;
    }

    /* directional input -------------------------------------------- */
    dir.set(
      (input.rt ? 1 : 0) - (input.lf ? 1 : 0),
      0,
      (input.bk ? 1 : 0) - (input.fw ? 1 : 0)
    );
    if (dir.lengthSq() > 0) dir.normalize();
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), holder.rotation.y);

    const speed = WALK_SPEED *
                  (moveState === MoveState.GROUNDED ? 1 : AIR_CONTROL) *
                  (input.sprint ? SPRINT_FACTOR : 1);

    horiz.set(dir.x * speed, dir.z * speed);

    /* KCC integration ---------------------------------------------- */
    const requested = {
      x: horiz.x * w.time.dt,
      y: vertVel  * w.time.dt,
      z: horiz.y * w.time.dt
    };
    kcc.computeColliderMovement(collider, requested);
    const actual = kcc.computedMovement();

    if (vertVel > 0 && actual.y < requested.y * 0.9) vertVel = 0; // head hit

    const p = rb.translation();
    rb.setNextKinematicTranslation({
      x: p.x + actual.x,
      y: p.y + actual.y,
      z: p.z + actual.z
    });
    holder.position.set(p.x + actual.x, p.y + actual.y, p.z + actual.z);

    /* shooting ------------------------------------------------------ */
    const shootStart = input.shoot && !prevShoot;
    if (shootStart && now - lastShot > SHOOT_CD_MS) {
      spawnBullet(w, three.camera, rapier);
      lastShot = now;
    }
    prevShoot = input.shoot;

    return w;
  };
}

/* bullet helper ---------------------------------------------------- */
function spawnBullet(
  w: ECS, camera: THREE.Camera,
  R: typeof import('@dimforge/rapier3d')
) {
  const { physics, maps } = w.ctx;

  const eid = addEntity(w);
  addComponent(w, Projectile,   eid);
  addComponent(w, Lifespan,     eid);
  addComponent(w, RigidBodyRef, eid);
  addComponent(w, MeshRef,      eid);
  addComponent(w, Transform,    eid);
  addComponent(w, Velocity,     eid);

  Lifespan.ttl[eid]  = BULLET_TTL_MS;
  Lifespan.born[eid] = performance.now();

  /* mesh */
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({
      color: 0xff9900, roughness: 0.3, metalness: 0.7,
      emissive: 0xff9900, emissiveIntensity: 0.5
    })
  );
  mesh.castShadow = true;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir).normalize();
  const spawn = new THREE.Vector3();
  camera.getWorldPosition(spawn).addScaledVector(dir, 0.5);
  mesh.position.copy(spawn);

  w.ctx.three.scene.add(mesh);
  maps.mesh.set(eid, mesh);

  /* rigid body */
  Velocity.x[eid] = dir.x * BULLET_SPEED;
  Velocity.y[eid] = dir.y * BULLET_SPEED;
  Velocity.z[eid] = dir.z * BULLET_SPEED;

  const rb = physics.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(spawn.x, spawn.y, spawn.z)
      .setLinvel(dir.x * BULLET_SPEED, dir.y * BULLET_SPEED, dir.z * BULLET_SPEED)
      .setCcdEnabled(true)
  );
  physics.createCollider(
    R.ColliderDesc.ball(0.1).setRestitution(0.6).setFriction(0.1), rb
  );

  maps.rb.set(eid, rb);
  RigidBodyRef.id[eid] = rb.handle;
}
