/**
 * ドミノ列の復帰 (起こし直し) 判定ロジック。
 *
 * 倒れたまま放置すると詰まりの原因になるため、一定枚数以上倒れて
 * かつ最後の接触からしばらく経過したら復帰させる。ただし連鎖の
 * 途中 (直前までボールが接触していた) は起こし直さない。
 */
export interface DominoRecoveryParams {
  /** 現在倒れているドミノの枚数。 */
  fallenCount: number;
  /** ドミノの総枚数。 */
  totalCount: number;
  /** 最後にボールが接触してからの経過時間 (ms)。 */
  msSinceLastContact: number;
  /** 復帰までの待機時間 (ms)。 */
  recoveryWaitMs: number;
}

/**
 * ドミノ列を起こし直すべきかどうかを判定する。
 *
 * - 1 枚も倒れていなければ復帰不要 (false)。
 * - 全て倒れていれば、直前の接触に関わらず復帰する (true)。連鎖が最後まで
 *   到達しており、それ以上倒れるドミノが残っていないため。
 * - 一部だけ倒れている場合は、最後の接触から recoveryWaitMs 以上経過して
 *   いれば復帰する。経過していなければ連鎖の途中とみなし復帰しない。
 */
export function shouldRecoverDominoes(params: DominoRecoveryParams): boolean {
  const { fallenCount, totalCount, msSinceLastContact, recoveryWaitMs } = params;

  if (!Number.isInteger(totalCount) || totalCount <= 0) {
    throw new Error(`totalCount は正の整数である必要があります: ${totalCount}`);
  }
  if (!Number.isInteger(fallenCount) || fallenCount < 0 || fallenCount > totalCount) {
    throw new Error(
      `fallenCount は 0 以上 totalCount 以下の整数である必要があります: ${fallenCount}`
    );
  }
  if (!Number.isFinite(msSinceLastContact) || msSinceLastContact < 0) {
    throw new Error(
      `msSinceLastContact は 0 以上の有限値である必要があります: ${msSinceLastContact}`
    );
  }
  if (!Number.isFinite(recoveryWaitMs) || recoveryWaitMs <= 0) {
    throw new Error(`recoveryWaitMs は正の有限値である必要があります: ${recoveryWaitMs}`);
  }

  if (fallenCount === 0) {
    return false;
  }

  if (fallenCount === totalCount) {
    return true;
  }

  return msSinceLastContact >= recoveryWaitMs;
}
