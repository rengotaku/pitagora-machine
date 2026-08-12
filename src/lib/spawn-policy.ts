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
export function shouldSpawnBall(params: SpawnCheckParams): boolean;
export function shouldSpawnBall(
  activeBalls: number,
  msSinceLastSpawn: number,
  nextDelayMs: number,
  maxActiveBalls: number
): boolean;
export function shouldSpawnBall(
  arg1: SpawnCheckParams | number,
  arg2?: number,
  arg3?: number,
  arg4?: number
): boolean {
  let activeBalls: number;
  let msSinceLastSpawn: number;
  let nextDelayMs: number;
  let maxActiveBalls: number;

  if (typeof arg1 === "object") {
    activeBalls = arg1.activeBalls;
    msSinceLastSpawn = arg1.msSinceLastSpawn;
    nextDelayMs = arg1.nextDelayMs;
    maxActiveBalls = arg1.maxActiveBalls;
  } else {
    activeBalls = arg1;
    msSinceLastSpawn = arg2!;
    nextDelayMs = arg3!;
    maxActiveBalls = arg4!;
  }

  if (activeBalls <= 0) {
    return true;
  }

  if (activeBalls >= maxActiveBalls) {
    return false;
  }

  return msSinceLastSpawn >= nextDelayMs;
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
