/**********************************************************************
 * player.ts – first-person controller (movement + shooting)
 *********************************************************************/
import { addComponent, addEntity, defineQuery } from 'bitecs';
import * as THREE from 'three';
import {
  MeshRef, Player, RigidBodyRef, Transform,
  Projectile, Lifespan, Velocity, FPController
} from '../components';
import { ECS } from '../world';
import { InputState } from './input.js';

/* constants -------------------------------------------------------- */
const WALK_SPEED     = 8;
const SPRINT_FACTOR  = 1.8;
const AIR_CONTROL    = 0.7;
const JUMP_VEL       = 14;
const GRAVITY        = 20;
const TERMINAL_FALL  = -20;

const JUMP_CD_MS     = 300;
const COYOTE_MS      = 150;
const JUMP_BUFFER_MS = 200;
const SHOOT_CD_MS    = 200;
const BULLET_SPEED   = 40;
const BULLET_TTL_MS  = 5000;

const MOUSE_SENSITIVITY = 0.0035;

// Movement state enum values
const GROUNDED = 0;
const JUMPING = 1;
const FALLING = 2;

/* ------------------------------------------------------------------ */
export function initPlayerSystem(world: ECS) {
  const { rapier, physics, three, maps } = world.ctx;

  /* entity + mesh holder ------------------------------------------- */
  const pid = addEntity(world);
  addComponent(world, Player,       pid);
  addComponent(world, Transform,    pid);
  addComponent(world, MeshRef,      pid);
  addComponent(world, RigidBodyRef, pid);
  addComponent(world, FPController, pid);
  
  // Initialize controller state
  FPController.pitch[pid] = 0;
  FPController.vertVel[pid] = 0;
  FPController.moveState[pid] = GROUNDED;
  FPController.lastGrounded[pid] = performance.now();
  FPController.lastJump[pid] = 0;
  FPController.lastShot[pid] = 0;
  FPController.jumpRequested[pid] = 0;
  FPController.lastJumpRequest[pid] = 0;

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

  const dir = new THREE.Vector3();
  const horiz = new THREE.Vector2();
  
  // Track the previous shoot state to detect start of shooting
  let prevShoot = false;

  /* system --------------------------------------------------------- */
  return (w: ECS) => {
    const input = w.input as InputState;
    if (!input) return w;

    /* mouse-look ---------------------------------------------------- */
    if (input.pointerLocked) {
      holder.rotation.y = (holder.rotation.y - input.dx * MOUSE_SENSITIVITY) % (Math.PI * 2);
      if (holder.rotation.y < 0) holder.rotation.y += Math.PI * 2;

      FPController.pitch[pid] = THREE.MathUtils.clamp(
        FPController.pitch[pid] - input.dy * MOUSE_SENSITIVITY, 
        -Math.PI / 2, 
        Math.PI / 2
      );
      three.camera.rotation.x = FPController.pitch[pid];
    }
    input.dx = input.dy = 0;

    /* movement state + gravity ------------------------------------- */
    const now = performance.now();
    const grounded = kcc.computedGrounded();
    if (grounded) FPController.lastGrounded[pid] = now;

    if (grounded) {
      FPController.moveState[pid] = GROUNDED;
    } else {
      FPController.moveState[pid] = FPController.vertVel[pid] > 0 ? JUMPING : FALLING;
    }
    
    // Handle jump buffering - store jump request timing
    if (input.jump && FPController.jumpRequested[pid] === 0) {
      FPController.jumpRequested[pid] = 1;
      FPController.lastJumpRequest[pid] = now;
    } else if (!input.jump) {
      FPController.jumpRequested[pid] = 0;
    }

    // Check if we can jump with either direct input or buffered input
    const canJump = (grounded || now - FPController.lastGrounded[pid] < COYOTE_MS) && 
                    now - FPController.lastJump[pid] > JUMP_CD_MS;
    
    // Execute jump if conditions met, including buffered jumps
    if (canJump && (input.jump || (now - FPController.lastJumpRequest[pid] < JUMP_BUFFER_MS))) {
      FPController.vertVel[pid] = JUMP_VEL;
      FPController.lastJump[pid] = now;
      FPController.jumpRequested[pid] = 0;
    }

    if (FPController.moveState[pid] !== GROUNDED) {
      FPController.vertVel[pid] = Math.max(FPController.vertVel[pid] - GRAVITY * w.time.dt, TERMINAL_FALL);
    } else {
      FPController.vertVel[pid] *= 0.8;
      if (Math.abs(FPController.vertVel[pid]) < 0.1) FPController.vertVel[pid] = 0;
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
                  (FPController.moveState[pid] === GROUNDED ? 1 : AIR_CONTROL) *
                  (input.sprint ? SPRINT_FACTOR : 1);

    horiz.set(dir.x * speed, dir.z * speed);

    /* KCC integration ---------------------------------------------- */
    const requested = {
      x: horiz.x * w.time.dt,
      y: FPController.vertVel[pid] * w.time.dt,
      z: horiz.y * w.time.dt
    };
    kcc.computeColliderMovement(collider, requested);
    const actual = kcc.computedMovement();

    if (FPController.vertVel[pid] > 0 && actual.y < requested.y * 0.9) {
      FPController.vertVel[pid] = 0; // head hit
    }

    const p = rb.translation();
    rb.setNextKinematicTranslation({
      x: p.x + actual.x,
      y: p.y + actual.y,
      z: p.z + actual.z
    });
    holder.position.set(p.x + actual.x, p.y + actual.y, p.z + actual.z);

    /* shooting ------------------------------------------------------ */
    const shootStart = input.shoot && !prevShoot;
    if (shootStart && now - FPController.lastShot[pid] > SHOOT_CD_MS) {
      spawnBullet(w, three.camera, rapier);
      FPController.lastShot[pid] = now;
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
