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

describe("timestep: effectiveMs (レビュー指摘 #2 回帰テスト)", () => {
  // タブのバックグラウンド復帰などで elapsedMs が maxStepsPerFrame を大幅に超えても、
  // 装置側ロジック (エレベーター駆動・停滞検知) に渡る実効経過時間は
  // maxStepsPerFrame * fixedDeltaMs を超えてはならない。これを超えると、物理エンジンは
  // 打ち切られて僅かしか進んでいないのに、エレベーターが瞬間移動したり停滞検知が
  // 「数秒間動いていない」と誤判定して全ボールを回収してしまう。
  it("巨大な elapsed (タブ復帰想定, 3000ms) でも effectiveMs は maxStepsPerFrame * fixedDeltaMs を超えない", () => {
    const fixedDeltaMs = 16.666;
    const maxStepsPerFrame = 5;
    const calc = createTimestepCalculator({ fixedDeltaMs, maxStepsPerFrame });

    const result = calc.update(3000);

    expect(result.steps).toBe(maxStepsPerFrame);
    expect(result.effectiveMs).toBeLessThanOrEqual(maxStepsPerFrame * fixedDeltaMs);
    expect(result.effectiveMs).toBeCloseTo(maxStepsPerFrame * fixedDeltaMs, 3);
  });

  it("打ち切りが発生しない通常フレームでは effectiveMs = steps * fixedDeltaMs と一致する", () => {
    const fixedDeltaMs = 16.666;
    const maxStepsPerFrame = 5;
    const calc = createTimestepCalculator({ fixedDeltaMs, maxStepsPerFrame });

    const result = calc.update(16.666);

    expect(result.steps).toBe(1);
    expect(result.effectiveMs).toBeCloseTo(fixedDeltaMs, 3);
  });

  it("端数のみで steps=0 のフレームでは effectiveMs=0 になる", () => {
    const fixedDeltaMs = 16.666;
    const maxStepsPerFrame = 5;
    const calc = createTimestepCalculator({ fixedDeltaMs, maxStepsPerFrame });

    const result = calc.update(8);

    expect(result.steps).toBe(0);
    expect(result.effectiveMs).toBe(0);
  });

  it("maxStepsPerFrame に非整数を渡すと例外を投げる", () => {
    // 非整数を許すと打ち切り時に steps が小数になり、呼び出し側の
    // `for (i < steps)` が回る回数（切り上げ）と effectiveMs（小数ステップ分）が
    // 食い違って、物理時間と装置側ロジックの時間がずれる。
    expect(() =>
      createTimestepCalculator({ fixedDeltaMs: 16.666, maxStepsPerFrame: 2.5 })
    ).toThrow(/正の整数/);
    expect(() =>
      createTimestepCalculator({
        fixedDeltaMs: 16.666,
        maxStepsPerFrame: Number.NaN,
      })
    ).toThrow(/正の整数/);
  });
});
