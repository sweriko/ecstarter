import { addComponent } from 'bitecs';
import { world } from './world';
import {
  MoveDir, LookDir, JumpReq, ShootReq,
  PlayerTag
} from './components';

/* Attach key / mouse listeners – fill MoveDir / LookDir ... */
export function registerInput(playerEid: number) {
  addComponent(world, MoveDir,  playerEid);
  addComponent(world, LookDir,  playerEid);
  addComponent(world, JumpReq,  playerEid);
  addComponent(world, ShootReq, playerEid);

  const keys = new Set<string>();
  addEventListener('keydown', e => keys.add(e.code));
  addEventListener('keyup',   e => keys.delete(e.code));

  /* pointer-lock helpers */
  const msg = document.getElementById('msg')!;
  addEventListener('click', () => { (document.body as any).requestPointerLock?.(); });

  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement) msg.style.display='none';
    else                             msg.style.display='';
  });

  addEventListener('mousemove', e => {
    if (!document.pointerLockElement) return;
    LookDir.dx[playerEid] += e.movementX;
    LookDir.dy[playerEid] += e.movementY;
  });

  addEventListener('mousedown', e => {
    if (e.button===0) ShootReq.value[playerEid] = 1;
  });

  addEventListener('mouseup', e => {
    if (e.button===0) ShootReq.value[playerEid] = 0;
  });

  /* update MoveDir each frame */
  const moveMap: Record<string,{x:number,z:number}> = {
    KeyW:{x:0,z:-1}, ArrowUp:{x:0,z:-1},
    KeyS:{x:0,z: 1}, ArrowDown:{x:0,z: 1},
    KeyA:{x:-1,z:0}, ArrowLeft:{x:-1,z:0},
    KeyD:{x: 1,z:0}, ArrowRight:{x: 1,z:0},
  };

  world.inputUpdate = () => {
    let mx=0,mz=0;
    for (const k of keys) if (moveMap[k]) { mx+=moveMap[k].x; mz+=moveMap[k].z; }
    const len = Math.hypot(mx,mz)||1;
    MoveDir.x[playerEid] = mx/len;
    MoveDir.z[playerEid] = mz/len;
    JumpReq.value[playerEid] = keys.has('Space') ? 1 : 0;
  };
}

/* called from main pipeline each tick */
export function pollInput() {
  if (typeof world.inputUpdate === 'function') world.inputUpdate();
}
