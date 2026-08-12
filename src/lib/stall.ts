/**
 * ボールのスタック（停止・挟まり）検知ロジック。
 *
 * 速度ではなく位置の変位（基準座標からの離脱距離）で検知することで、
 * 隙間で微振動しているが前に進まないボールを正確に検知する。
 */

export interface StallSample {
  id: number;
  x: number;
  y: number;
}

export interface StallOptions {
  minTravelDistance: number;
  stallDurationMs: number;
}

export interface StallTracker {
  update(samples: StallSample[], elapsedMs: number): number[];
  forget(id: number): void;
}

interface TrackedBallState {
  originX: number;
  originY: number;
  stalledMs: number;
}

/**
 * スタック検知トラッカーを生成する。
 */
export function createStallTracker(options: StallOptions): StallTracker {
  const { minTravelDistance, stallDurationMs } = options;

  if (
    typeof minTravelDistance !== "number" ||
    !Number.isFinite(minTravelDistance) ||
    minTravelDistance <= 0
  ) {
    throw new Error(
      `minTravelDistance は正の有限数値である必要があります: ${minTravelDistance}`
    );
  }

  if (
    typeof stallDurationMs !== "number" ||
    !Number.isFinite(stallDurationMs) ||
    stallDurationMs <= 0
  ) {
    throw new Error(
      `stallDurationMs は正の有限数値である必要があります: ${stallDurationMs}`
    );
  }

  const trackedMap = new Map<number, TrackedBallState>();

  return {
    update(samples: StallSample[], elapsedMs: number): number[] {
      if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
        throw new Error(
          `elapsedMs は 0 以上の有限数値である必要があります: ${elapsedMs}`
        );
      }

      const activeIds = new Set<number>();
      const stalledIds: number[] = [];

      for (const sample of samples) {
        activeIds.add(sample.id);

        let state = trackedMap.get(sample.id);
        if (!state) {
          state = {
            originX: sample.x,
            originY: sample.y,
            stalledMs: 0,
          };
          trackedMap.set(sample.id, state);
        }

        const dist = Math.hypot(sample.x - state.originX, sample.y - state.originY);
        if (dist >= minTravelDistance) {
          state.originX = sample.x;
          state.originY = sample.y;
          state.stalledMs = 0;
        } else {
          state.stalledMs += elapsedMs;
        }

        if (state.stalledMs >= stallDurationMs) {
          stalledIds.push(sample.id);
        }
      }

      // samples に含まれていない id の内部状態を破棄 (TC-13)
      for (const id of trackedMap.keys()) {
        if (!activeIds.has(id)) {
          trackedMap.delete(id);
        }
      }

      return stalledIds;
    },

    forget(id: number): void {
      trackedMap.delete(id);
    },
  };
}
