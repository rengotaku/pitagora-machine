/**
 * 固定タイムステップの計算ロジック。
 */

export interface TimestepOptions {
  fixedDeltaMs: number;
  maxStepsPerFrame: number;
}

export interface TimestepResult {
  steps: number;
  remainderMs: number;
  /**
   * 今フレームで実際に物理エンジンを進めた実効経過時間 (steps * fixedDeltaMs)。
   * タブのバックグラウンド復帰などで elapsedMs が maxStepsPerFrame を超える巨大な
   * 値になっても、この値は常に maxStepsPerFrame * fixedDeltaMs 以下に収まる。
   * 物理エンジン以外の時間依存ロジック（エレベーター駆動・停滞検知など）は、
   * 生の elapsedMs ではなくこの値を時間源として使うことで、物理世界の進み具合と
   * 整合させる。
   */
  effectiveMs: number;
}

export interface TimestepCalculator {
  update(elapsedMs: number): TimestepResult;
  reset(): void;
}

/**
 * 固定ステップ幅 fixedDeltaMs と 1 フレームあたりの最大ステップ数 maxStepsPerFrame を持ち、
 * 経過時間から今フレームで進めるべきステップ数と持ち越す端数を計算するトラッカーを作成する。
 */
export function createTimestepCalculator(options: TimestepOptions): TimestepCalculator {
  const { fixedDeltaMs, maxStepsPerFrame } = options;

  if (
    typeof fixedDeltaMs !== "number" ||
    !Number.isFinite(fixedDeltaMs) ||
    fixedDeltaMs <= 0
  ) {
    throw new Error(`fixedDeltaMs は正の有限数値である必要があります: ${fixedDeltaMs}`);
  }

  if (
    typeof maxStepsPerFrame !== "number" ||
    !Number.isFinite(maxStepsPerFrame) ||
    maxStepsPerFrame <= 0
  ) {
    throw new Error(
      `maxStepsPerFrame は正の有限数値である必要があります: ${maxStepsPerFrame}`
    );
  }

  let accumulatedMs = 0;

  return {
    update(elapsedMs: number): TimestepResult {
      if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
        throw new Error(
          `elapsedMs は 0 以上の有限数値である必要があります: ${elapsedMs}`
        );
      }

      const totalMs = accumulatedMs + elapsedMs;
      const rawSteps = Math.floor(totalMs / fixedDeltaMs);

      if (rawSteps > maxStepsPerFrame) {
        // maxStepsPerFrame を超える累積時間は破棄し、次回フレームに大量ステップを持ち越さない (TC-4)
        accumulatedMs = 0;
        return {
          steps: maxStepsPerFrame,
          remainderMs: 0,
          effectiveMs: maxStepsPerFrame * fixedDeltaMs,
        };
      }

      const steps = rawSteps;
      const remainderMs = totalMs - steps * fixedDeltaMs;
      accumulatedMs = remainderMs;

      return {
        steps,
        remainderMs,
        effectiveMs: steps * fixedDeltaMs,
      };
    },

    reset(): void {
      accumulatedMs = 0;
    },
  };
}
