import { createWorld } from 'bitecs';
import * as THREE      from 'three';
import * as RAPIER     from '@dimforge/rapier3d';

export const world = createWorld();

/* frame clock */
world.time = { delta:0, elapsed:0, then:performance.now() };

export const meshes: THREE.Mesh[] = [];
export const bodies: RAPIER.RigidBody[] = [];
export const kccs:   RAPIER.KinematicCharacterController[] = [];
