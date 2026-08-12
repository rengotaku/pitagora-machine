/**
 * ボール投入 (Spawn) ポリシーの実装。
 */
import type { Rng } from "./random";
import { randomRange } from "./random";

export interface SpawnCheckParams {
  activeBalls: number;
  msSinceLastSpawn: number;
  nextDelayMs: number;
  maxActiveBalls: number;
}

/**
 * 新しいボールを投入すべきかどうかを判定する。
 *
 * - 画面内にボールが 1 個もない (activeBalls <= 0) 場合は経過時間に関わらず最優先で true を返す。
 * - 画面内のボール数が上限 (activeBalls >= maxActiveBalls) に達している場合は false を返す。
 * - それ以外は直前投入からの経過時間 (msSinceLastSpawn) が nextDelayMs 以上経過していれば true を返す。
 */
export function shouldSpawnBall(params: SpawnCheckParams): boolean {
  if (params.activeBalls <= 0) {
    return true;
  }

  if (params.activeBalls >= params.maxActiveBalls) {
    return false;
  }

  return params.msSinceLastSpawn >= params.nextDelayMs;
}

/**
 * 次のボール投入までの遅延時間 (ms) を計算する。
 * 既存の randomRange を使用する。
 */
export function nextSpawnDelay(rng: Rng, minMs: number, maxMs: number): number {
  if (minMs > maxMs) {
    throw new Error(`minMs (${minMs}) は maxMs (${maxMs}) 以下である必要があります`);
  }

  return randomRange(rng, minMs, maxMs);
}
