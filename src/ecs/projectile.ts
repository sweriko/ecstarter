import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d';
import { addEntity, addComponent } from 'bitecs';
import { world, meshes, bodies } from './world';
import {
  Position,Rotation,MeshRef,BodyRef,ProjectileTag,Life
} from './components';
import { updatePlayer } from './kcc';

declare const scene: THREE.Scene;
declare const rapierWorld: RAPIER.World;

/* config */
const SPEED      = 40;
const SIZE       = 0.12;
const LIFESPAN   = 4000; // ms
const RESTITUTION= 0.6;

export function initProjectile(){
  /* inject into main pipeline so input→shoot works */
  const basePhysicsSystem = world.playerSystem
    ? (dt:number)=>{ updatePlayer(dt); }
    : ()=>{};
  world.playerSystem = basePhysicsSystem;
}

export function shootProjectile(cam: THREE.Camera){
  const origin = new THREE.Vector3();
  cam.getWorldPosition(origin);
  origin.add(new THREE.Vector3(0,1.4,0)); // eye height

  const dir = new THREE.Vector3();
  cam.getWorldDirection(dir).normalize();

  /* entity */
  const eid = addEntity(world);
  addComponent(world, ProjectileTag, eid);
  addComponent(world, Life,        eid); Life.ms[eid] = LIFESPAN;

  /* Three mesh */
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(SIZE,8,8),
    new THREE.MeshStandardMaterial({ color:0xff9900, emissive:0xff6600, emissiveIntensity:0.7 })
  );
  mesh.position.copy(origin);
  scene.add(mesh);
  meshes.push(mesh);
  addComponent(world, MeshRef, eid); MeshRef.id[eid]=meshes.length-1;

  /* Rapier body */
  const rb = rapierWorld.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
       .setTranslation(origin.x,origin.y,origin.z)
       .setLinvel(dir.x*SPEED, dir.y*SPEED, dir.z*SPEED)
       .setCcdEnabled(true)
       .setAdditionalMass(0.2)
  );
  rapierWorld.createCollider(
    RAPIER.ColliderDesc.ball(SIZE)
      .setRestitution(RESTITUTION)
      .setFriction(0.1),
    rb
  );
  bodies.push(rb);
  addComponent(world, BodyRef, eid); BodyRef.id[eid]=bodies.length-1;

  addComponent(world, Position, eid);
  addComponent(world, Rotation, eid);
}
