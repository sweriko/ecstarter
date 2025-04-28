import { addComponent, addEntity } from 'bitecs';
import * as THREE from 'three';
import {
  MeshRef, Player, RigidBodyRef, Transform,
  Projectile, Lifespan, Velocity
} from '../components';
import { ECS } from '../world';
import { InputState } from './input.js';

/* Movement states */
enum MovementState {
  GROUNDED,
  JUMPING,
  FALLING,
  SLIDING
}

/* ───────── initialise player entity & system ───── */
export function initPlayerSystem(world: ECS) {
  const { rapier, physics, three, maps } = world.ctx;

  /* ███  ECS entity  ███ */
  const pid = addEntity(world);
  addComponent(world, Player, pid);
  addComponent(world, Transform, pid);
  addComponent(world, MeshRef, pid);
  addComponent(world, RigidBodyRef, pid);

  /* Three object that carries the camera */
  const holder = new THREE.Object3D();
  holder.position.set(0, 3, 6); // Start a bit higher
  holder.add(three.camera);
  three.scene.add(holder);
  maps.mesh.set(pid, holder);

  /* Rapier kinematic controller stuff */
  const rb = physics.createRigidBody(
    rapier.RigidBodyDesc.kinematicPositionBased()
      .setTranslation(holder.position.x, holder.position.y, holder.position.z)
      .setCcdEnabled(true)
  );
  const collider = physics.createCollider(
    rapier.ColliderDesc.capsule(0.9, 0.3).setFriction(0.2),
    rb
  );
  
  // Create character controller
  const kcc = physics.createCharacterController(0.01); // Small offset for better collision
  kcc.setApplyImpulsesToDynamicBodies(true);
  kcc.setUp({ x: 0, y: 1, z: 0 });
  kcc.enableAutostep(0.5, 0.3, true);
  kcc.enableSnapToGround(0.3);
  kcc.setMaxSlopeClimbAngle(0.8); // ~45 degrees
  kcc.setMinSlopeSlideAngle(0.6);

  // Add to maps for tracking
  maps.rb.set(pid, rb);
  RigidBodyRef.id[pid] = rb.handle;

  /* view state */
  let pitch = 0;
  const MOVE_SPEED = 5.0;
  const dir = new THREE.Vector3();
  const horizontalVelocity = new THREE.Vector2(0, 0);
  let verticalVelocity = 0;
  let movementState = MovementState.GROUNDED;
  let canJump = true;
  let jumpRequested = false;
  let lastJumpTime = 0;
  let lastGroundedTime = 0;
  
  // Movement parameters
  const JUMP_VELOCITY = 10.0;
  const JUMP_COOLDOWN = 300; // ms
  const COYOTE_TIME = 150; // ms
  const AIR_CONTROL = 0.7;
  const GRAVITY_FORCE = 20.0;
  const GROUND_ACCELERATION = 10.0;
  const AIR_ACCELERATION = 5.0;

  /* ───────── the actual system function ─────────── */
  return (w: ECS) => {
    const input = w.input;
    if (!input) return w;

    /* camera rotation */
    if (input.pointerLocked) {
      holder.rotation.y -= input.dx * 0.002;
      pitch = THREE.MathUtils.clamp(pitch - input.dy * 0.002, -Math.PI / 2, Math.PI / 2);
      three.camera.rotation.x = pitch;
    }
    input.dx = input.dy = 0; // reset deltas
    
    // Check if movement state should be updated
    const now = Date.now();
    const isGrounded = kcc.computedGrounded();
    
    // Update grounded time for coyote time
    if (isGrounded) {
      lastGroundedTime = now;
    }
    
    // Update movement state
    if (isGrounded) {
      movementState = MovementState.GROUNDED;
    } else {
      if (verticalVelocity > 0) {
        movementState = MovementState.JUMPING;
      } else {
        movementState = MovementState.FALLING;
      }
    }
    
    // Update jump ability with coyote time
    canJump = isGrounded || (now - lastGroundedTime < COYOTE_TIME);
    
    // Handle jump input
    if (input.jump && canJump && now - lastJumpTime > JUMP_COOLDOWN) {
      verticalVelocity = JUMP_VELOCITY;
      jumpRequested = false;
      lastJumpTime = now;
      movementState = MovementState.JUMPING;
      canJump = false;
    }
    
    // Apply gravity based on movement state
    if (movementState === MovementState.JUMPING || 
        movementState === MovementState.FALLING) {
      verticalVelocity -= GRAVITY_FORCE * w.time.dt;
    } else {
      // Gradually reduce vertical velocity when grounded
      verticalVelocity *= 0.8;
      if (Math.abs(verticalVelocity) < 0.1) {
        verticalVelocity = 0;
      }
    }
    
    // Clamp maximum falling speed
    if (verticalVelocity < -20) {
      verticalVelocity = -20;
    }

    /* movement vector in world space */
    dir.set(
      (input.rt ? 1 : 0) - (input.lf ? 1 : 0),
      0,
      (input.bk ? 1 : 0) - (input.fw ? 1 : 0)
    );
    
    if (dir.lengthSq() > 0) dir.normalize();
    
    // Apply rotation to direction
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), holder.rotation.y);
    
    // Calculate move factor based on state
    const moveFactor = (movementState === MovementState.JUMPING || 
                        movementState === MovementState.FALLING) ? 
                        AIR_CONTROL : 1.0;
    
    // Set horizontal velocity based on input direction
    horizontalVelocity.x = dir.x * MOVE_SPEED * moveFactor;
    horizontalVelocity.y = dir.z * MOVE_SPEED * moveFactor;

    // Calculate final movement vector with delta time
    const movementVector = {
      x: horizontalVelocity.x * w.time.dt,
      y: verticalVelocity * w.time.dt,
      z: horizontalVelocity.y * w.time.dt
    };
    
    // Use the character controller to compute correct movement
    kcc.computeColliderMovement(
      collider,
      movementVector
    );
    
    // Get corrected movement from character controller
    const correctedMovement = kcc.computedMovement();
    
    // Check for head collision
    if (verticalVelocity > 0 && correctedMovement.y < movementVector.y * 0.9) {
      // Hit ceiling or obstacle above, zero out upward velocity
      verticalVelocity = 0;
    }
    
    // Apply the movement to the rigid body
    const currentPos = rb.translation();
    const newPos = {
      x: currentPos.x + correctedMovement.x,
      y: currentPos.y + correctedMovement.y,
      z: currentPos.z + correctedMovement.z
    };
    
    // Update rigid body position
    rb.setNextKinematicTranslation(newPos);
    
    /* shooting */
    if (input.shoot) spawnBullet(w, holder, three.camera, rapier);

    return w;
  };
}

/* ───────── spawnBullet helper ───────────────────── */
function spawnBullet(
  w: ECS,
  holder: THREE.Object3D,
  camera: THREE.Camera,
  R: typeof import('@dimforge/rapier3d')
) {
  const { physics, maps } = w.ctx;

  /* entity */
  const bid = addEntity(w);
  addComponent(w, Projectile, bid);
  addComponent(w, Lifespan, bid);
  addComponent(w, RigidBodyRef, bid);
  addComponent(w, MeshRef, bid);
  addComponent(w, Velocity, bid);

  Lifespan.ttl[bid] = 5000;
  Lifespan.born[bid] = performance.now();

  /* Three mesh */
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.1, 8, 8),
    new THREE.MeshStandardMaterial({ 
      color: 0xff9900,
      roughness: 0.3,
      metalness: 0.7,
      emissive: 0xff9900,
      emissiveIntensity: 0.5
    })
  );
  mesh.castShadow = true;
  camera.getWorldPosition(mesh.position);
  w.ctx.three.scene.add(mesh);
  maps.mesh.set(bid, mesh);

  /* Rapier rigid-body */
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir).normalize();
  const speed = 40;

  // Store velocity in component
  Velocity.x[bid] = dir.x * speed;
  Velocity.y[bid] = dir.y * speed;
  Velocity.z[bid] = dir.z * speed;

  // Create rigid body with velocity
  const rb = physics.createRigidBody(
    R.RigidBodyDesc.dynamic()
      .setTranslation(mesh.position.x, mesh.position.y, mesh.position.z)
      .setLinvel(dir.x * speed, dir.y * speed, dir.z * speed)
      .setCcdEnabled(true)
  );
  physics.createCollider(
    R.ColliderDesc.ball(0.1)
      .setRestitution(0.6)
      .setFriction(0.1), 
    rb
  );

  maps.rb.set(bid, rb);
  RigidBodyRef.id[bid] = rb.handle;
}
