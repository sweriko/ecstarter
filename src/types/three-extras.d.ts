 /* Allow importing Three geometry helpers that lack @types */
declare module 'three/examples/jsm/geometries/CapsuleGeometry.js' {
    import { BufferGeometry } from 'three';
    export class CapsuleGeometry extends BufferGeometry {
      constructor(radius?:number, length?:number, capSegments?:number, radialSegments?:number);
    }
  }
  