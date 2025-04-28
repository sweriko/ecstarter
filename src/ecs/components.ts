import { Types, defineComponent } from 'bitecs';

/** World-space transform (quat-pos) */
export const Transform = defineComponent({
  x: Types.f32, y: Types.f32, z: Types.f32,
  qx: Types.f32, qy: Types.f32, qz: Types.f32, qw: Types.f32
});

/** Linear velocity – used for projectiles */
export const Velocity = defineComponent({ x: Types.f32, y: Types.f32, z: Types.f32 });

/** TTL in milliseconds (bullets) */
export const Lifespan = defineComponent({ ttl: Types.f32, born: Types.f32 });

/** Tags */
export const Player   = defineComponent();
export const Projectile = defineComponent();
export const CubeTag  = defineComponent();

/** Foreign-object indirection – store handles in JS Maps */
export const RigidBodyRef = defineComponent({ id: Types.ui32 });
export const MeshRef      = defineComponent({ id: Types.ui32 });
