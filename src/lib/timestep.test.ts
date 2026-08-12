import { describe, expect, it } from "vitest";
import { createTimestepCalculator } from "./timestep";

describe("timestep (TC-1 ~ TC-6)", () => {
  it("TC-1: fixedDelta=16.666, max=5, 端数 0, elapsed=16.666 を渡すと steps=1, 端数ほぼ 0", () => {
    const calc = createTimestepCalculator({
      fixedDeltaMs: 16.666,
      maxStepsPerFrame: 5,
    });
    const result = calc.update(16.666);
    expect(result.steps).toBe(1);
    expect(result.remainderMs).toBeCloseTo(0, 3);
  });

  it("TC-2: fixedDelta=16.666, max=5, 端数 0, elapsed=8 を渡すと steps=0, 端数 8 が持ち越される", () => {
    const calc = createTimestepCalculator({
      fixedDeltaMs: 16.666,
      maxStepsPerFrame: 5,
    });
    const result = calc.update(8);
    expect(result.steps).toBe(0);
    expect(result.remainderMs).toBeCloseTo(8, 3);
  });

  it("TC-3: fixedDelta=16.666, max=5, 端数 0, elapsed=8 を 3 回連続で渡すと合計 24ms 到達時点で steps=1, 端数が 7.33 前後になる", () => {
    const calc = createTimestepCalculator({
      fixedDeltaMs: 16.666,
      maxStepsPerFrame: 5,
    });
    const res1 = calc.update(8);
    expect(res1.steps).toBe(0);
    expect(res1.remainderMs).toBeCloseTo(8, 3);

    const res2 = calc.update(8);
    expect(res2.steps).toBe(0);
    expect(res2.remainderMs).toBeCloseTo(16, 3);

    const res3 = calc.update(8);
    expect(res3.steps).toBe(1);
    expect(res3.remainderMs).toBeCloseTo(7.334, 2);
  });

  it("TC-4: fixedDelta=16.666, max=5, 端数 0, elapsed=1000 では steps が max=5 で打ち切られ、端数に 1000ms が溜まり続けない", () => {
    const calc = createTimestepCalculator({
      fixedDeltaMs: 16.666,
      maxStepsPerFrame: 5,
    });
    const result = calc.update(1000);
    expect(result.steps).toBe(5);
    expect(result.remainderMs).toBeLessThan(16.666);

    const nextResult = calc.update(16.666);
    expect(nextResult.steps).toBe(1);
  });

  it("TC-5: elapsed=-1 / NaN / Infinity を渡すと例外を投げる", () => {
    const calc = createTimestepCalculator({
      fixedDeltaMs: 16.666,
      maxStepsPerFrame: 5,
    });
    expect(() => calc.update(-1)).toThrow();
    expect(() => calc.update(NaN)).toThrow();
    expect(() => calc.update(Infinity)).toThrow();
  });

  it("TC-6: fixedDelta<=0 または max<=0 で生成すると例外を投げる", () => {
    expect(() =>
      createTimestepCalculator({ fixedDeltaMs: 0, maxStepsPerFrame: 5 })
    ).toThrow();
    expect(() =>
      createTimestepCalculator({ fixedDeltaMs: -10, maxStepsPerFrame: 5 })
    ).toThrow();
    expect(() =>
      createTimestepCalculator({ fixedDeltaMs: 16.666, maxStepsPerFrame: 0 })
    ).toThrow();
    expect(() =>
      createTimestepCalculator({ fixedDeltaMs: 16.666, maxStepsPerFrame: -1 })
    ).toThrow();
  });

  it("追加テスト: elapsedMs が 0 の場合は steps=0 で端数も変化しない / 0ms フレームの動作確認", () => {
    const calc = createTimestepCalculator({
      fixedDeltaMs: 16.666,
      maxStepsPerFrame: 5,
    });
    calc.update(8);
    const res = calc.update(0);
    expect(res.steps).toBe(0);
    expect(res.remainderMs).toBeCloseTo(8, 3);
  });

  it("追加テスト: reset() を呼ぶと蓄積された端数が 0 にクリアされる / reset API の正常動作確認", () => {
    const calc = createTimestepCalculator({
      fixedDeltaMs: 16.666,
      maxStepsPerFrame: 5,
    });
    calc.update(10);
    calc.reset();
    const res = calc.update(8);
    expect(res.steps).toBe(0);
    expect(res.remainderMs).toBeCloseTo(8, 3);
  });
});
