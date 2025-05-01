import { addComponent, addEntity, defineQuery, enterQuery, exitQuery } from 'bitecs';
import * as THREE from 'three';
import { Grass } from '../components';
import { ECS } from '../world';
import { GrassComponent } from '../utils/grass';

/**
 * Grass system for ECS
 */
export function initGrassSystem(world: ECS) {
  // Create queries
  const grassQuery = defineQuery([Grass]);
  const grassQueryEnter = enterQuery(grassQuery);
  const grassQueryExit = exitQuery(grassQuery);
  
  // Create a Grass entity when system initializes
  const init = () => {
    // Make sure we have textures directory
    const texturesPath = './public/textures';
    
    // Check if we already have a grass entity
    if (grassQuery(world).length === 0) {
      // Create a new entity with Grass component
      const grassEntity = addEntity(world);
      addComponent(world, Grass, grassEntity);
      
      // Initialize the GrassComponent
      const grassComponent = new GrassComponent(
        world.ctx.three.scene, 
        world.ctx.three.camera
      );
      
      // Store in the maps for reference
      world.ctx.maps.grass = new Map();
      world.ctx.maps.grass.set(grassEntity, grassComponent);
    }
  };
  
  init();

  // Main system function
  return (world: ECS) => {
    // Get the delta time from the world
    const dt = world.time.dt;
    
    // Handle entering entities (none expected after init)
    const enterEntities = grassQueryEnter(world);
    for (let i = 0; i < enterEntities.length; i++) {
      const entity = enterEntities[i];
      console.log(`Grass entity ${entity} entered`);
    }
    
    // Handle exiting entities
    const exitEntities = grassQueryExit(world);
    for (let i = 0; i < exitEntities.length; i++) {
      const entity = exitEntities[i];
      console.log(`Grass entity ${entity} exited`);
      
      // Clean up resources
      if (world.ctx.maps.grass && world.ctx.maps.grass.has(entity)) {
        const grassComponent = world.ctx.maps.grass.get(entity);
        // grassComponent cleanup if needed
        world.ctx.maps.grass.delete(entity);
      }
    }
    
    // Update all grass entities
    const entities = grassQuery(world);
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      
      // Update the grass component
      if (world.ctx.maps.grass && world.ctx.maps.grass.has(entity)) {
        const grassComponent = world.ctx.maps.grass.get(entity);
        
        // Check if grassComponent exists before using it
        if (grassComponent) {
          // Get player position
          let playerPosition = new THREE.Vector3();
          
          // If we have a player entity, get its position
          if (world.ctx.three.camera) {
            playerPosition.copy(world.ctx.three.camera.position);
          }
          
          // Update grass component with elapsed time and player position
          grassComponent.update(dt, playerPosition);
          
          // Update the totalTime in the component
          Grass.totalTime[entity] += dt;
        }
      }
    }
    
    return world;
  };
} 