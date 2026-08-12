import { describe, expect, it } from "vitest";
import { canSpawnBall } from "./ball-budget";

describe("ball-budget (TC-9 ~ TC-12)", () => {
  it("TC-9: 上限 6 個、現在 6 個で追加投入を要求すると拒否される", () => {
    const result = canSpawnBall({ currentCount: 6, maxCount: 6 });
    expect(result).toBe(false);
  });

  it("TC-10: 上限 6 個、現在 6 個から 1 個を回収してから投入を要求すると許可される (総数が上限を超えない)", () => {
    const currentCount = 6 - 1;
    const result = canSpawnBall({ currentCount, maxCount: 6 });
    expect(result).toBe(true);
  });

  it("TC-11: 現在 0 個で投入を要求すると許可される (最低 1 個ルールが優先)", () => {
    const result = canSpawnBall({ currentCount: 0, maxCount: 6 });
    expect(result).toBe(true);
  });

  it("TC-12: 回収と投入を 10000 回繰り返しても、総数は常に 0 < 総数 <= 上限に収まり、リークしない", () => {
    const maxCount = 6;
    // シード不要な決定的な擬似パターンで回収/投入をランダムに模す (Math.random は使わない)。
    let count = 1;
    let seed = 123456789;
    const nextBit = (): number => {
      // xorshift32: テスト専用の決定的な 0/1 系列生成 (src/lib/random.ts の
      // createRng とは別に、このテストの反復パターンだけを作るための最小実装)。
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      seed |= 0;
      return seed & 1;
    };

    for (let i = 0; i < 10000; i += 1) {
      if (nextBit() === 0) {
        // 回収 + 即座に再投入 (simulation.ts の stall 検知・画面外脱落と同じ
        // パターン: 1 個取り除いたら同じ tick で必ず 1 個投入し直す)。
        // 回収直後は「最低 1 個ルール」により canSpawnBall は必ず許可を返す。
        if (count > 0) {
          count -= 1;
          expect(canSpawnBall({ currentCount: count, maxCount })).toBe(true);
          count += 1;
        }
      } else if (canSpawnBall({ currentCount: count, maxCount })) {
        // 独立した投入判定 (spawn-policy の時間経過ベース投入)
        count += 1;
      }

      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(maxCount);
    }
  });

  it("追加テスト: 不正な入力 (負の currentCount、0 以下・非整数の maxCount) は例外を投げる", () => {
    expect(() => canSpawnBall({ currentCount: -1, maxCount: 6 })).toThrow();
    expect(() => canSpawnBall({ currentCount: 0, maxCount: 0 })).toThrow();
    expect(() => canSpawnBall({ currentCount: 0, maxCount: -3 })).toThrow();
    expect(() => canSpawnBall({ currentCount: 0, maxCount: 3.5 })).toThrow();
    expect(() => canSpawnBall({ currentCount: Number.NaN, maxCount: 6 })).toThrow();
  });
});
