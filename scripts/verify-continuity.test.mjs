import { describe, expect, it } from "vitest";
import {
  analyzeContinuity,
  calculateQuantile,
  isBall,
} from "./verify-continuity.mjs";

describe("verify-continuity: isBall", () => {
  it("半径が 14〜22 の非整数をボールとして認識する", () => {
    expect(isBall({ x: 100, y: 100, r: 18.1234 })).toBe(true);
    expect(isBall({ x: 100, y: 100, r: 14.001 })).toBe(true);
    expect(isBall({ x: 100, y: 100, r: 21.999 })).toBe(true);
  });

  it("半径が整数の場合は部品（ネジ・ギミック等）とみなして除外する", () => {
    expect(isBall({ x: 100, y: 100, r: 15.0 })).toBe(false);
    expect(isBall({ x: 100, y: 100, r: 18.0 })).toBe(false);
    expect(isBall({ x: 100, y: 100, r: 20 })).toBe(false);
  });

  it("半径が 14〜22 の範囲外の非整数は除外する", () => {
    expect(isBall({ x: 100, y: 100, r: 7.5 })).toBe(false);
    expect(isBall({ x: 100, y: 100, r: 13.999 })).toBe(false);
    expect(isBall({ x: 100, y: 100, r: 22.001 })).toBe(false);
    expect(isBall({ x: 100, y: 100, r: 35.5 })).toBe(false);
  });

  it("円オブジェクトが不正な場合は false を返す", () => {
    expect(isBall(null)).toBe(false);
    expect(isBall(undefined)).toBe(false);
    expect(isBall({ x: 100, y: 100, r: NaN })).toBe(false);
  });
});

describe("verify-continuity: calculateQuantile", () => {
  it("空配列の場合は 0 を返す", () => {
    expect(calculateQuantile([], 0.5)).toBe(0);
  });

  it("単一要素の配列ではその要素の値を返す", () => {
    expect(calculateQuantile([10], 0.5)).toBe(10);
    expect(calculateQuantile([10], 0.9)).toBe(10);
  });

  it("ソート済み配列の分位数を正しく計算する", () => {
    const values = [1, 2, 3, 4, 5];
    expect(calculateQuantile(values, 0)).toBe(1);
    expect(calculateQuantile(values, 0.5)).toBe(3);
    expect(calculateQuantile(values, 1.0)).toBe(5);
  });
});

describe("verify-continuity: analyzeContinuity", () => {
  it("空のフレームデータが渡された場合は初期化した空のサマリを返す", () => {
    const summary = analyzeContinuity([]);
    expect(summary.totalFrames).toBe(0);
    expect(summary.averageFps).toBe(0);
    expect(summary.displacements.count).toBe(0);
    expect(summary.overshootEvents.count).toBe(0);
    expect(summary.suddenEvents.count).toBe(0);
  });

  it("連続したスムーズなボール移動では変位が正しく計算されイベントは 0 件となる", () => {
    const frames = [
      {
        timestamp: 1000,
        circles: [{ x: 100, y: 100, r: 18.5 }],
      },
      {
        timestamp: 1016.6,
        circles: [{ x: 102, y: 100, r: 18.5 }], // 変位 2px
      },
      {
        timestamp: 1033.3,
        circles: [{ x: 104, y: 100, r: 18.5 }], // 変位 2px
      },
    ];

    const summary = analyzeContinuity(frames);
    expect(summary.totalFrames).toBe(3);
    expect(summary.displacements.count).toBe(2);
    expect(summary.displacements.p50).toBe(2);
    expect(summary.displacements.max).toBe(2);
    expect(summary.overshootEvents.count).toBe(0);
    expect(summary.suddenEvents.count).toBe(0);
  });

  it("1 フレームで 36px を超える変位（ボール直径超え）を検出する", () => {
    const frames = [
      {
        timestamp: 1000,
        circles: [{ x: 100, y: 100, r: 18.5 }],
      },
      {
        timestamp: 1016.6,
        circles: [{ x: 145, y: 100, r: 18.5 }], // 変位 45px (> 36px)
      },
    ];

    const summary = analyzeContinuity(frames);
    expect(summary.overshootEvents.count).toBe(1);
    expect(summary.overshootEvents.items[0]).toMatchObject({
      ballRadius: 18.5,
      displacement: 45,
      x: 145,
      y: 100,
    });
  });

  it("直前フレームの 3 倍超かつ 5px 超の変位（急変イベント）を検出する", () => {
    const frames = [
      {
        timestamp: 1000,
        circles: [{ x: 100, y: 100, r: 18.5 }],
      },
      {
        timestamp: 1016.6,
        circles: [{ x: 101, y: 100, r: 18.5 }], // 変位 1px
      },
      {
        timestamp: 1033.3,
        circles: [{ x: 110, y: 100, r: 18.5 }], // 変位 9px (> 5px かつ > 3 * 1px)
      },
    ];

    const summary = analyzeContinuity(frames);
    expect(summary.suddenEvents.count).toBe(1);
    expect(summary.suddenEvents.items[0]).toMatchObject({
      ballRadius: 18.5,
      displacement: 9,
      prevDisplacement: 1,
      x: 110,
      y: 100,
    });
  });

  it("急変条件（直前の3倍超）を満たさない変位は急変イベントとしてカウントしない", () => {
    const frames = [
      {
        timestamp: 1000,
        circles: [{ x: 100, y: 100, r: 18.5 }],
      },
      {
        timestamp: 1016.6,
        circles: [{ x: 105, y: 100, r: 18.5 }], // 変位 5px
      },
      {
        timestamp: 1033.3,
        circles: [{ x: 112, y: 100, r: 18.5 }], // 変位 7px (7 > 5 だが 7 <= 3 * 5 = 15)
      },
    ];

    const summary = analyzeContinuity(frames);
    expect(summary.suddenEvents.count).toBe(0);
  });
});
