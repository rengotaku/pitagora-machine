/**
 * ボール総数の収支管理ロジック。
 *
 * 回収 (stall 検知・画面外脱落) と投入 (spawn) を繰り返しても、装置内の
 * ボール総数が上限を超えて増え続けたり (fps 低下の原因)、0 のまま減り
 * 続けたり (装置が止まる) しないことを保証する判定を、投入タイミングの
 * 判定 (spawn-policy.ts の shouldSpawnBall) から独立させた純粋関数として置く。
 */

export interface BallBudgetParams {
  /** 現在アクティブなボールの総数。 */
  currentCount: number;
  /** 許容する総数の上限。 */
  maxCount: number;
}

/**
 * 新しいボールを投入してよいかどうかを判定する。
 *
 * - 現在の総数が 0 以下なら、上限に関わらず常に許可する (最低 1 個ルールが
 *   上限より優先される。装置が完全に空になり止まったままになるのを防ぐ)。
 * - それ以外は、投入後も総数が上限を超えないときのみ許可する。
 */
export function canSpawnBall(params: BallBudgetParams): boolean {
  if (!Number.isFinite(params.currentCount) || params.currentCount < 0) {
    throw new Error(
      `currentCount は 0 以上の有限数値である必要があります: ${params.currentCount}`
    );
  }
  if (!Number.isInteger(params.maxCount) || params.maxCount <= 0) {
    throw new Error(`maxCount は正の整数である必要があります: ${params.maxCount}`);
  }

  if (params.currentCount <= 0) {
    return true;
  }

  return params.currentCount < params.maxCount;
}
