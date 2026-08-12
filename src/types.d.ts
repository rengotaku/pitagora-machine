export interface GimmickStats {
  ramp1: number;
  seesaw: number;
  launcher: number;
  ramp2: number;
  elevator: number;
  branchLeft: number;
  branchRight: number;
  pendulum: number;
  domino: number;
  wheel: number;
  bounceFloor: number;
}

export interface PitagoraStats {
  activeBalls: number;
  minActiveBalls: number;
  fps: number;
  elapsedMs: number;
  recoveredBalls: number;
  outOfBoundsBalls: number;
  gimmicks: GimmickStats;
}

declare global {
  interface Window {
    __pitagora?: PitagoraStats;
  }
}
