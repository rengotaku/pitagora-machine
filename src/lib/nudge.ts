/**
 * 「押し出し (nudge)」判定ロジック。
 *
 * stall 検知 (src/lib/stall.ts) より手前の段階で、同じ場所に留まり続ける
 * ボールを軽く押し出す対象を判定する。stall 検知と同じ「原点からの変位」で
 * 停滞を検知するが、以下の点で stall とは異なる:
 *
 * - しきい値が短い (nudgeThresholdMs < stallDurationMs)。stall に達する前に
 *   先に nudge を試みる。
 * - 一度 nudge したら cooldownMs の間は再判定しない (nudge した直後の慣性・
 *   衝突応答をノイズとして拾い、連続で小突き続けることを防ぐ)。
 * - maxNudgeCount 回 nudge しても停滞が解消しなければ、それ以上は nudge せず
 *   諦める (無限に小突き続けるのではなく、より確実な stall 検知による回収に
 *   委ねる)。
 *
 * 🔴 本ロジックは経路設計 (勾配・摩擦・着地条件・仕掛けの間隔の見直し) を
 * 優先したうえで、それでも残る局所的な停滞にだけ適用する保険的な手段である。
 */

export interface NudgeSample {
  id: number;
  x: number;
  y: number;
}

export interface NudgeOptions {
  /** これ未満の移動量は「停滞している」とみなす。 */
  minTravelDistance: number;
  /** これ以上停滞したら nudge 対象にする (ms)。 */
  nudgeThresholdMs: number;
  /** nudge した後、次に nudge するまでの猶予 (ms)。 */
  cooldownMs: number;
  /** この回数を超えて nudge しても停滞が続く場合は諦める。 */
  maxNudgeCount: number;
}

export interface NudgeTracker {
  /** 今回 nudge すべきボールの id 一覧を返す。 */
  update(samples: NudgeSample[], elapsedMs: number): number[];
  /** 追跡状態を破棄する (ボールが回収・脱落した時に呼ぶ)。 */
  forget(id: number): void;
}

interface TrackedNudgeState {
  originX: number;
  originY: number;
  stalledMs: number;
  cooldownRemainingMs: number;
  nudgeCount: number;
}

function assertPositive(name: string, value: number): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} は正の有限数値である必要があります: ${value}`);
  }
}

/**
 * nudge 判定トラッカーを生成する。
 */
export function createNudgeTracker(options: NudgeOptions): NudgeTracker {
  const { minTravelDistance, nudgeThresholdMs, cooldownMs, maxNudgeCount } = options;

  assertPositive("minTravelDistance", minTravelDistance);
  assertPositive("nudgeThresholdMs", nudgeThresholdMs);
  assertPositive("cooldownMs", cooldownMs);
  if (!Number.isInteger(maxNudgeCount) || maxNudgeCount <= 0) {
    throw new Error(`maxNudgeCount は正の整数である必要があります: ${maxNudgeCount}`);
  }

  const trackedMap = new Map<number, TrackedNudgeState>();

  return {
    update(samples: NudgeSample[], elapsedMs: number): number[] {
      if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0) {
        throw new Error(
          `elapsedMs は 0 以上の有限数値である必要があります: ${elapsedMs}`
        );
      }

      const activeIds = new Set<number>();
      const nudgeIds: number[] = [];

      for (const sample of samples) {
        activeIds.add(sample.id);

        let state = trackedMap.get(sample.id);
        if (!state) {
          state = {
            originX: sample.x,
            originY: sample.y,
            stalledMs: 0,
            cooldownRemainingMs: 0,
            nudgeCount: 0,
          };
          trackedMap.set(sample.id, state);
        }

        const dist = Math.hypot(sample.x - state.originX, sample.y - state.originY);
        if (dist >= minTravelDistance) {
          // 十分動いた: 停滞判定・nudge 回数ともにリセットする
          state.originX = sample.x;
          state.originY = sample.y;
          state.stalledMs = 0;
          state.nudgeCount = 0;
        } else {
          state.stalledMs += elapsedMs;
        }

        if (state.cooldownRemainingMs > 0) {
          state.cooldownRemainingMs = Math.max(0, state.cooldownRemainingMs - elapsedMs);
        }

        const shouldNudge =
          state.stalledMs >= nudgeThresholdMs &&
          state.cooldownRemainingMs <= 0 &&
          state.nudgeCount < maxNudgeCount;

        if (shouldNudge) {
          nudgeIds.push(sample.id);
          state.cooldownRemainingMs = cooldownMs;
          state.nudgeCount += 1;
        }
      }

      // samples に含まれていない id の内部状態を破棄する (stall.ts と同様)
      for (const id of trackedMap.keys()) {
        if (!activeIds.has(id)) {
          trackedMap.delete(id);
        }
      }

      return nudgeIds;
    },

    forget(id: number): void {
      trackedMap.delete(id);
    },
  };
}
