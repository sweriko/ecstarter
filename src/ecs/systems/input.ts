import { ECS } from '../world';

export interface InputState {
  fw: boolean; bk: boolean; lf: boolean; rt: boolean;
  shoot: boolean; jump: boolean; pointerLocked: boolean;
  dx: number; dy: number;
}

export function initInputSystem(world: ECS) {
  const state: InputState = { 
    fw: false, bk: false, lf: false, rt: false,
    shoot: false, jump: false, pointerLocked: false,
    dx: 0, dy: 0 
  };
  
  const key = (code: string, v: boolean) => {
    if (code==='KeyW'||code==='ArrowUp')   state.fw = v;
    if (code==='KeyS'||code==='ArrowDown') state.bk = v;
    if (code==='KeyA'||code==='ArrowLeft') state.lf = v;
    if (code==='KeyD'||code==='ArrowRight')state.rt = v;
    if (code==='Space')                    state.jump = v;
  };
  addEventListener('keydown', e=>key(e.code,true));
  addEventListener('keyup',   e=>key(e.code,false));

  const canvas = document.getElementById('c')!;
  canvas.addEventListener('click', () => canvas.requestPointerLock());
  document.addEventListener('pointerlockchange', () => state.pointerLocked = !!document.pointerLockElement);
  addEventListener('mousemove', e=>{
    if(!state.pointerLocked) return;
    state.dx += e.movementX; state.dy += e.movementY;
  });
  addEventListener('mousedown', e=>{ if(e.button===0) state.shoot = true; });
  addEventListener('mouseup',   e=>{ if(e.button===0) state.shoot = false; });

  /* system */
  return (w: ECS) => { w.input = state; return w; };
}
