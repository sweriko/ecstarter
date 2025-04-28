import { IWorld } from 'bitecs';

declare module 'bitecs' {
  interface IWorld {
    time: {
      delta: number;
      elapsed: number;
      then: number;
    };
    playerSystem?: (dt: number) => void;
    inputUpdate?: () => void;
  }
} 