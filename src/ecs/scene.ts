/**********************************************************************
 * scene.ts – Three + Rapier initialisation & scene population
 *********************************************************************/
import * as THREE  from 'three';
import * as RAPIER from '@dimforge/rapier3d';
import { addComponent, addEntity } from 'bitecs';
import {
  CubeTag, MeshRef, RigidBodyRef, Transform
} from './components';
import { ECS, ECSContext } from './world';

/* ------------------------------------------------------------------ */
/* createContext – bootstrap renderer / physics / camera              */
export async function createContext(
  canvas: HTMLCanvasElement
): Promise<ECSContext> {
  /* Rapier ---------------------------------------------------------- */
  const rapier  = RAPIER;
  const physics = new rapier.World({ x: 0, y: -9.81, z: 0 });

  /* Three renderer -------------------------------------------------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  scene.fog        = new THREE.FogExp2(0x88BBFF, 0.0025);

  const camera = new THREE.PerspectiveCamera(
    75, window.innerWidth / window.innerHeight, 0.1, 1000
  );

  /* Lighting -------------------------------------------------------- */
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(5, 10, 7);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.left = -20;
  dirLight.shadow.camera.right = 20;
  dirLight.shadow.camera.top = 20;
  dirLight.shadow.camera.bottom = -20;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far  = 50;
  scene.add(dirLight);

  /* Sky dome -------------------------------------------------------- */
  const sky = new THREE.SphereGeometry(400, 32, 15).scale(-1, 1, 1);
  scene.add(new THREE.Mesh(
    sky, new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide })
  ));

  /* Ground ---------------------------------------------------------- */
  const HALF_H = 0.05;                 // 0.1 m thick collider
  const GROUND_Y = -HALF_H;

  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x1a5f2a, roughness: 0.8, metalness: 0.2 })
  );
  groundMesh.receiveShadow = true;
  groundMesh.position.y    = GROUND_Y;
  scene.add(groundMesh);

  const groundBody = physics.createRigidBody(
    rapier.RigidBodyDesc.fixed().setTranslation(0, GROUND_Y, 0)
  );
  physics.createCollider(
    rapier.ColliderDesc.cuboid(100, HALF_H, 100), groundBody
  );

  /* Window-resize --------------------------------------------------- */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return {
    rapier, physics,
    three: { scene, camera, renderer },
    maps : { mesh: new Map(), rb: new Map() }
  };
}

/* ------------------------------------------------------------------ */
/* populateScene – central cube stack + scattered cubes               */
export function populateScene(world: ECS, ctx: ECSContext): void {
  const { rapier, physics, maps, three } = ctx;

  const makeCube = (
    x: number, y: number, z: number,
    size = 1, color = Math.random() * 0xffffff
  ) => {
    /* Three mesh ---------------------------------------------------- */
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.3 })
    );
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    three.scene.add(mesh);

    /* Rapier body --------------------------------------------------- */
    const rb = physics.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
            .setTranslation(x, y, z)
            .setCcdEnabled(true)
    );
    physics.createCollider(
      rapier.ColliderDesc.cuboid((size * 0.98) / 2, (size * 0.98) / 2, (size * 0.98) / 2)
            .setRestitution(0.4)
            .setFriction(0.5),
      rb
    );

    /* ECS entity ---------------------------------------------------- */
    const eid = addEntity(world);
    addComponent(world, CubeTag,     eid);
    addComponent(world, Transform,   eid);
    addComponent(world, MeshRef,     eid);
    addComponent(world, RigidBodyRef,eid);

    maps.mesh.set(eid, mesh);
    maps.rb.set(eid, rb);
    RigidBodyRef.id[eid] = rb.handle;
  };

  /* 6×6×6 stack */
  for (let y = 0; y < 6; ++y)
    for (let x = 0; x < 6; ++x)
      for (let z = 0; z < 6; ++z)
        makeCube(x - 3, y + 0.5, z - 3);

  /* extra cubes */
  for (let i = 0; i < 20; i++)
    makeCube(
      (Math.random() - 0.5) * 20,
      10 + Math.random() * 10,
      (Math.random() - 0.5) * 20,
      0.5 + Math.random() * 1.5
    );
}
