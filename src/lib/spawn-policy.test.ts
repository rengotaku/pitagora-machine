import { describe, expect, it } from "vitest";
import { createRng } from "./random";
import { nextSpawnDelay, shouldSpawnBall } from "./spawn-policy";

describe("spawn-policy (TC-15 ~ TC-20)", () => {
  it("TC-15: maxActiveBalls=6, activeBalls=0, 経過時間 0ms で判定すると true", () => {
    const result = shouldSpawnBall({
      activeBalls: 0,
      msSinceLastSpawn: 0,
      nextDelayMs: 2000,
      maxActiveBalls: 6,
    });
    expect(result).toBe(true);
  });

  it("TC-16: maxActiveBalls=6, activeBalls=6 で待ち時間を超過して判定しても false", () => {
    const result = shouldSpawnBall({
      activeBalls: 6,
      msSinceLastSpawn: 5000,
      nextDelayMs: 2000,
      maxActiveBalls: 6,
    });
    expect(result).toBe(false);
  });

  it("TC-17: maxActiveBalls=6, activeBalls=3, msSinceLastSpawn < nextDelayMs で判定すると false", () => {
    const result = shouldSpawnBall({
      activeBalls: 3,
      msSinceLastSpawn: 1000,
      nextDelayMs: 2000,
      maxActiveBalls: 6,
    });
    expect(result).toBe(false);
  });

  it("TC-18: maxActiveBalls=6, activeBalls=3, msSinceLastSpawn >= nextDelayMs で判定すると true", () => {
    const result = shouldSpawnBall({
      activeBalls: 3,
      msSinceLastSpawn: 2000,
      nextDelayMs: 2000,
      maxActiveBalls: 6,
    });
    expect(result).toBe(true);
  });

  it("TC-19: min=1500, max=4000 で nextSpawnDelay をシード付き乱数で 500 回呼ぶとすべて 1500 以上 4000 未満に収まる", () => {
    const rng = createRng(12345);
    for (let i = 0; i < 500; i += 1) {
      const delay = nextSpawnDelay(rng, 1500, 4000);
      expect(delay).toBeGreaterThanOrEqual(1500);
      expect(delay).toBeLessThan(4000);
    }
  });

  it("TC-20: min > max で nextSpawnDelay を呼ぶと例外を投げる", () => {
    const rng = createRng(12345);
    expect(() => nextSpawnDelay(rng, 4000, 1500)).toThrow();
  });

  it("追加テスト: nextSpawnDelay で minMs === maxMs の場合その値を正確に返す / 同一範囲指定時の確認", () => {
    const rng = createRng(12345);
    const delay = nextSpawnDelay(rng, 2000, 2000);
    expect(delay).toBe(2000);
  });

  it("追加テスト: shouldSpawnBall がオーバーロード引数（数値並び）でも正しく動作する / シグネチャ互換性の確認", () => {
    expect(shouldSpawnBall(0, 0, 2000, 6)).toBe(true);
    expect(shouldSpawnBall(6, 5000, 2000, 6)).toBe(false);
    expect(shouldSpawnBall(3, 1000, 2000, 6)).toBe(false);
    expect(shouldSpawnBall(3, 2000, 2000, 6)).toBe(true);
  });
});
