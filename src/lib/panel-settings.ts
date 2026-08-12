/**
 * デバッグ設定パネルの設定値バリデーション・クランプ (issue #6)。
 *
 * UI (range input 等) から渡ってくる値は number とは限らない (NaN / undefined /
 * 文字列を含みうる) ため、すべて unknown で受け取り、範囲外・不正値は
 * 例外を投げずに安全な値へ丸める。装置が壊れる値 (速度 0・ボール数 0) は
 * 絶対に通さない。
 */

/** 重力 (Matter.js の engine.gravity.y に対応)。0 でも装置が破綻しないことを許容する下限。 */
export const GRAVITY_MIN = 0;
export const GRAVITY_MAX = 2;
export const GRAVITY_DEFAULT = 1;

/** ボール数の上限設定。0 個は「常に 1 個以上動いている」要件に反するため許可しない。 */
export const BALL_COUNT_MIN = 1;
export const BALL_COUNT_MAX = 12;
export const BALL_COUNT_DEFAULT = 5;

/** シミュレーション速度。0 は装置が停止するため許可しない。 */
export const SPEED_SCALE_MIN = 0.25;
export const SPEED_SCALE_MAX = 2;
export const SPEED_SCALE_DEFAULT = 1;

export interface PanelSettings {
  gravity: number;
  ballCount: number;
  speedScale: number;
}

/**
 * value が有限の数値であればそのまま、範囲外なら [min, max] にクランプして返す。
 * 数値でない・NaN・Infinity の場合は fallback を返す (例外を投げない)。
 */
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

/** 重力を [GRAVITY_MIN, GRAVITY_MAX] にクランプする。不正値は既定値にフォールバックする。 */
export function clampGravity(value: unknown): number {
  return clampNumber(value, GRAVITY_MIN, GRAVITY_MAX, GRAVITY_DEFAULT);
}

/**
 * ボール数を [BALL_COUNT_MIN, BALL_COUNT_MAX] にクランプし、整数に丸める。
 * 不正値は既定値にフォールバックする。
 */
export function clampBallCount(value: unknown): number {
  return Math.round(
    clampNumber(value, BALL_COUNT_MIN, BALL_COUNT_MAX, BALL_COUNT_DEFAULT)
  );
}

/** シミュレーション速度を [SPEED_SCALE_MIN, SPEED_SCALE_MAX] にクランプする。不正値は既定値にフォールバックする。 */
export function clampSpeedScale(value: unknown): number {
  return clampNumber(value, SPEED_SCALE_MIN, SPEED_SCALE_MAX, SPEED_SCALE_DEFAULT);
}

/** パネルの既定設定値。すべて各範囲内に収まっている。 */
export function getDefaultSettings(): PanelSettings {
  return {
    gravity: GRAVITY_DEFAULT,
    ballCount: BALL_COUNT_DEFAULT,
    speedScale: SPEED_SCALE_DEFAULT,
  };
}
