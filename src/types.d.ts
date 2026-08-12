export interface PitagoraStats {
  activeBalls: number;
  minActiveBalls: number;
  fps: number;
  elapsedMs: number;
  recoveredBalls?: number;
}

declare global {
  interface Window {
    __pitagora?: PitagoraStats;
  }
}
