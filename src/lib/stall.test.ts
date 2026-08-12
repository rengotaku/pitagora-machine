import { describe, expect, it } from "vitest";
import { createStallTracker } from "./stall";

describe("stall (TC-7 ~ TC-14)", () => {
  it("TC-7: minTravel=20, stallDuration=3000 で毎回 50px 移動するボールを 10 秒ぶん update しても一度も検知されない", () => {
    const tracker = createStallTracker({
      minTravelDistance: 20,
      stallDurationMs: 3000,
    });
    for (let i = 1; i <= 100; i += 1) {
      const stalled = tracker.update([{ id: 1, x: i * 50, y: 0 }], 100);
      expect(stalled).toEqual([]);
    }
  });

  it("TC-8: 同じ座標のまま 3000ms を超えて update するとその id が返る", () => {
    const tracker = createStallTracker({
      minTravelDistance: 20,
      stallDurationMs: 3000,
    });
    const res1 = tracker.update([{ id: 1, x: 100, y: 100 }], 2000);
    expect(res1).toEqual([]);

    const res2 = tracker.update([{ id: 1, x: 100, y: 100 }], 1100);
    expect(res2).toEqual([1]);
  });

  it("TC-9: ±2px の微振動だけを続けて 3000ms 超えるとその id が返る", () => {
    const tracker = createStallTracker({
      minTravelDistance: 20,
      stallDurationMs: 3000,
    });
    let elapsed = 0;
    let detected: number[] = [];
    while (elapsed < 3500) {
      const offsetX = (elapsed % 4) - 2;
      const offsetY = (elapsed % 3) - 1;
      detected = tracker.update([{ id: 1, x: 100 + offsetX, y: 100 + offsetY }], 100);
      elapsed += 100;
      if (detected.length > 0) {
        break;
      }
    }
    expect(detected).toEqual([1]);
    expect(elapsed).toBeGreaterThanOrEqual(3000);
  });

  it("TC-10: 2900ms 停止 → 大きく移動 → 再び停止で移動によってタイマーがリセットされ再停止から 3000ms 経つまで検知されない", () => {
    const tracker = createStallTracker({
      minTravelDistance: 20,
      stallDurationMs: 3000,
    });
    // 2900ms 停止
    expect(tracker.update([{ id: 1, x: 0, y: 0 }], 2900)).toEqual([]);

    // 50px 移動
    expect(tracker.update([{ id: 1, x: 50, y: 0 }], 100)).toEqual([]);

    // 新位置で 2800ms 停止
    expect(tracker.update([{ id: 1, x: 50, y: 0 }], 2800)).toEqual([]);

    // さらに 300ms 停止 (計 3100ms)
    expect(tracker.update([{ id: 1, x: 50, y: 0 }], 300)).toEqual([1]);
  });

  it("TC-11: 一度検知された id を、回収後に新しい座標で追跡再開するとタイマーが 0 から始まり直後に再検知されない", () => {
    const tracker = createStallTracker({
      minTravelDistance: 20,
      stallDurationMs: 3000,
    });
    expect(tracker.update([{ id: 1, x: 0, y: 0 }], 3100)).toEqual([1]);

    tracker.forget(1);

    const res = tracker.update([{ id: 1, x: 500, y: 500 }], 100);
    expect(res).toEqual([]);
  });

  it("TC-12: 3 個中 2 個が同時に停止しているとき停止した 2 件の id のみが返る", () => {
    const tracker = createStallTracker({
      minTravelDistance: 20,
      stallDurationMs: 3000,
    });
    for (let step = 1; step <= 31; step += 1) {
      const res = tracker.update(
        [
          { id: 1, x: step * 50, y: 0 }, // 移動中
          { id: 2, x: 100, y: 100 }, // 停止
          { id: 3, x: 200, y: 200 }, // 停止
        ],
        100
      );
      if (step < 30) {
        expect(res).toEqual([]);
      } else {
        expect(res.sort()).toEqual([2, 3]);
      }
    }
  });

  it("TC-13: samples から消えた id があると内部状態が破棄され、同じ id が再登場したときに過去の停止時間を引き継がない", () => {
    const tracker = createStallTracker({
      minTravelDistance: 20,
      stallDurationMs: 3000,
    });
    // id: 1 が 2900ms 停止
    expect(tracker.update([{ id: 1, x: 0, y: 0 }], 2900)).toEqual([]);

    // id: 1 が samples から消去
    expect(tracker.update([], 100)).toEqual([]);

    // id: 1 が再登場して 500ms 停止 (リセットされているため検知されない)
    expect(tracker.update([{ id: 1, x: 0, y: 0 }], 500)).toEqual([]);
  });

  it("TC-14: minTravel<=0 または stallDuration<=0 で生成すると例外を投げる", () => {
    expect(() =>
      createStallTracker({ minTravelDistance: 0, stallDurationMs: 3000 })
    ).toThrow();
    expect(() =>
      createStallTracker({ minTravelDistance: -1, stallDurationMs: 3000 })
    ).toThrow();
    expect(() =>
      createStallTracker({ minTravelDistance: 20, stallDurationMs: 0 })
    ).toThrow();
    expect(() =>
      createStallTracker({ minTravelDistance: 20, stallDurationMs: -500 })
    ).toThrow();
  });

  it("追加テスト: 静止し続けるボールは回収・除外されるまで毎フレーム検知リストに含まれる / 継続的スタック検知の確認", () => {
    const tracker = createStallTracker({
      minTravelDistance: 20,
      stallDurationMs: 3000,
    });
    tracker.update([{ id: 1, x: 0, y: 0 }], 3000);
    const res1 = tracker.update([{ id: 1, x: 0, y: 0 }], 100);
    expect(res1).toEqual([1]);
    const res2 = tracker.update([{ id: 1, x: 0, y: 0 }], 100);
    expect(res2).toEqual([1]);
  });
});
