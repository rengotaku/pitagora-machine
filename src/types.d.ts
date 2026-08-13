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
  /** 発射装置から坂2 へ着地した直後に速度を補正した回数 */
  landingBoost: number;
  lowerPendulum: number;
}

export interface PitagoraStats {
  activeBalls: number;
  minActiveBalls: number;
  fps: number;
  elapsedMs: number;
  recoveredBalls: number;
  outOfBoundsBalls: number;
  trailIds?: number[];
  gimmicks: GimmickStats;
}

declare global {
  interface Window {
    __pitagora?: PitagoraStats;
  }
}
