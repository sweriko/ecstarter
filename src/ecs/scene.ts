import * as THREE from 'three';
import * as RAPIER from '@dimforge/rapier3d';
import { addEntity, addComponent } from 'bitecs';
import {
  CubeTag, MeshRef, RigidBodyRef, Transform
} from './components';
import { ECS, ECSContext } from './world';

/* -------------------------------------------------- */
/* createContext : sets up Three + Rapier but DOES NOT
   touch ECS.  This avoids the previous undefined world
   problems.                                          */
export async function createContext(canvas: HTMLCanvasElement): Promise<ECSContext> {
  /* Rapier */
  // Import Rapier properly
  const rapier = RAPIER;
  const physics = new rapier.World({ x: 0, y: -9.81, z: 0 });

  /* Three renderer / scene / camera ---------------- */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87CEEB);
  
  // Add fog for depth
  scene.fog = new THREE.FogExp2(0x88BBFF, 0.0025);

  /* camera */
  const camera = new THREE.PerspectiveCamera(
    75,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );

  /* Lights */
  // Ambient light
  scene.add(new THREE.AmbientLight(0xFFFFFF, 0.8));
  
  // Directional light with shadows
  const dirLight = new THREE.DirectionalLight(0xFFFFFF, 1.0);
  dirLight.position.set(5, 10, 7);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  dirLight.shadow.camera.left = -20;
  dirLight.shadow.camera.right = 20;
  dirLight.shadow.camera.top = 20;
  dirLight.shadow.camera.bottom = -20;
  scene.add(dirLight);

  /* Sky */
  const skyG = new THREE.SphereGeometry(400, 32, 15);
  skyG.scale(-1, 1, 1);
  scene.add(new THREE.Mesh(
    skyG,
    new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide })
  ));

  /* Ground plane / collider */
  const groundMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ 
      color: 0x1a5f2a, 
      roughness: 0.8,
      metalness: 0.2
    })
  );
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  const groundBody = physics.createRigidBody(rapier.RigidBodyDesc.fixed());
  physics.createCollider(rapier.ColliderDesc.cuboid(100, 0.1, 100), groundBody);

  // Handle window resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* return context object */
  return {
    rapier,
    physics,
    three: { scene, camera, renderer },
    maps: { mesh: new Map(), rb: new Map() }
  };
}

/* -------------------------------------------------- */
/* populateScene : may be called as soon as an ECS
   world exists, to register cubes (or later models)  */
export function populateScene(world: ECS, ctx: ECSContext): void {
  const { rapier, physics, maps, three } = ctx;

  const makeCube = (x: number, y: number, z: number, size: number = 1, color: number = Math.random() * 0xffffff) => {
    // Create Three.js mesh
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size, size, size),
      new THREE.MeshStandardMaterial({ 
        color,
        roughness: 0.7,
        metalness: 0.3
      })
    );
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.set(x, y, z);
    three.scene.add(mesh);

    // Create Rapier rigid body and collider
    const rb = physics.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(x, y, z)
        .setCcdEnabled(true)
    );
    physics.createCollider(
      rapier.ColliderDesc.cuboid(size/2 * 0.98, size/2 * 0.98, size/2 * 0.98)
        .setRestitution(0.4)
        .setFriction(0.5), 
      rb
    );

    /* ECS entity for cube */
    const eid = addEntity(world);
    addComponent(world, CubeTag, eid);
    addComponent(world, MeshRef, eid);
    addComponent(world, RigidBodyRef, eid);
    addComponent(world, Transform, eid);

    maps.mesh.set(eid, mesh);
    maps.rb.set(eid, rb);
    RigidBodyRef.id[eid] = rb.handle;
  };

  /* stack of 6 × 6 × 6 cubes (like original) */
  for (let y = 0; y < 6; ++y)
    for (let x = 0; x < 6; ++x)
      for (let z = 0; z < 6; ++z)
        makeCube(x - 3, y + 0.5, z - 3);
        
  // Create additional random cubes around the scene
  for (let i = 0; i < 20; i++) {
    const position = {
      x: (Math.random() - 0.5) * 20,
      y: 10 + Math.random() * 10,
      z: (Math.random() - 0.5) * 20
    };
    
    // Random size between 0.5 and 2
    const size = 0.5 + Math.random() * 1.5;
    
    // Random color
    const color = Math.random() * 0xffffff;
    
    makeCube(position.x, position.y, position.z, size, color);
  }
}
