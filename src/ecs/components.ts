import { defineComponent, Types } from 'bitecs';

/* transforms */
export const Position = defineComponent({ x:Types.f32, y:Types.f32, z:Types.f32 });
export const Rotation = defineComponent({ x:Types.f32, y:Types.f32, z:Types.f32, w:Types.f32 });

/* references */
export const MeshRef = defineComponent({ id:Types.ui32 });
export const BodyRef = defineComponent({ id:Types.ui32 });
export const KccRef  = defineComponent({ id:Types.ui32 });

/* -------- input / intent -------- */
export const MoveDir = defineComponent({ x:Types.f32, z:Types.f32 });
export const LookDir = defineComponent({ dx:Types.f32, dy:Types.f32 });
export const JumpReq = defineComponent({ value:Types.ui8 });   // 1 when jump pressed
export const ShootReq= defineComponent({ value:Types.ui8 });   // 1 when LMB down

/* -------- tags -------- */
export const PlayerTag     = defineComponent();
export const ProjectileTag = defineComponent();

/* -------- projectile data -------- */
export const Life = defineComponent({ ms:Types.f32 });
