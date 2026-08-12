/**
 * ボール個体差 (サイズ・質量・反発・色) の生成ロジック。
 *
 * 装置が毎回少しずつ違う動きになるよう、ボールごとに半径・反発・密度に
 * ばらつきを持たせる。既存のコアループ / 各仕掛けは半径 14〜22px の固定
 * 3 段階を前提にチューニングされているため、範囲はその実測レンジを踏襲し、
 * 反発・密度は既存の固定値 (restitution=0.5, density=0.002) を中心に、
 * 装置全体の挙動が破綻しない程度の幅に収める。
 */
import type { Rng } from "./random";
import { pick, randomRange } from "./random";

export interface BallVariationRange {
  minRadius: number;
  maxRadius: number;
  minRestitution: number;
  maxRestitution: number;
  minDensity: number;
  maxDensity: number;
}

export interface BallVariation {
  radius: number;
  restitution: number;
  density: number;
  color: string;
}

/** 既定のばらつき範囲。 */
export const DEFAULT_BALL_VARIATION_RANGE: BallVariationRange = {
  minRadius: 14,
  maxRadius: 22,
  minRestitution: 0.4,
  maxRestitution: 0.6,
  minDensity: 0.0016,
  maxDensity: 0.0024,
};

function assertRange(name: string, min: number, max: number): void {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new Error(`${name} の範囲が不正です: min=${min}, max=${max}`);
  }
}

/**
 * シード付き乱数からボール 1 個分の個体差 (半径・反発・密度・色) を生成する。
 * 同じ rng の状態から呼べば常に同じ結果になる (再現性)。
 */
export function generateBallVariation(
  rng: Rng,
  colors: readonly string[],
  range: BallVariationRange = DEFAULT_BALL_VARIATION_RANGE
): BallVariation {
  assertRange("radius", range.minRadius, range.maxRadius);
  assertRange("restitution", range.minRestitution, range.maxRestitution);
  assertRange("density", range.minDensity, range.maxDensity);

  if (range.minRadius <= 0) {
    throw new Error(`minRadius は正の値である必要があります: ${range.minRadius}`);
  }
  if (range.minRestitution < 0 || range.maxRestitution > 1) {
    throw new Error(
      `restitution は 0〜1 の範囲である必要があります: min=${range.minRestitution}, max=${range.maxRestitution}`
    );
  }
  if (range.minDensity <= 0) {
    throw new Error(`minDensity は正の値である必要があります: ${range.minDensity}`);
  }

  return {
    radius: randomRange(rng, range.minRadius, range.maxRadius),
    restitution: randomRange(rng, range.minRestitution, range.maxRestitution),
    density: randomRange(rng, range.minDensity, range.maxDensity),
    color: pick(rng, colors),
  };
}
