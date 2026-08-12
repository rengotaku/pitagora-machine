import { describe, expect, it } from "vitest";
import { createNudgeTracker } from "./nudge";

// issue #4 前提: nudge しきい値 1200ms、スタック検知 3000ms
const NUDGE_THRESHOLD_MS = 1200;
const STALL_DURATION_MS = 3000;

describe("nudge (TC-5 ~ TC-8)", () => {
  it("TC-5: 移動しているボールを判定すると nudge しない", () => {
    const tracker = createNudgeTracker({
      minTravelDistance: 20,
      nudgeThresholdMs: NUDGE_THRESHOLD_MS,
      cooldownMs: 500,
      maxNudgeCount: 3,
    });

    let x = 0;
    // 毎回 30px (>= minTravelDistance) ずつ動かしながら 2000ms 分判定する
    for (let i = 0; i < 20; i += 1) {
      x += 30;
      const nudged = tracker.update([{ id: 1, x, y: 0 }], 100);
      expect(nudged).not.toContain(1);
    }
  });

  it("TC-6: 1200ms 停滞したボールを判定すると nudge する", () => {
    const tracker = createNudgeTracker({
      minTravelDistance: 20,
      nudgeThresholdMs: NUDGE_THRESHOLD_MS,
      cooldownMs: 500,
      maxNudgeCount: 3,
    });

    // 静止したまま 1200ms 分経過させる (100ms x 12 回)
    let nudged: number[] = [];
    for (let i = 0; i < 11; i += 1) {
      nudged = tracker.update([{ id: 1, x: 100, y: 100 }], 100);
      expect(nudged).not.toContain(1);
    }
    // 12 回目 (合計 1200ms) で nudge 対象になる
    nudged = tracker.update([{ id: 1, x: 100, y: 100 }], 100);
    expect(nudged).toContain(1);
  });

  it("TC-7: nudge 直後に同じボールを判定すると連続 nudge しない (クールダウンが効く)", () => {
    const tracker = createNudgeTracker({
      minTravelDistance: 20,
      nudgeThresholdMs: NUDGE_THRESHOLD_MS,
      cooldownMs: 500,
      maxNudgeCount: 3,
    });

    for (let i = 0; i < 11; i += 1) {
      tracker.update([{ id: 1, x: 100, y: 100 }], 100);
    }
    const firstNudge = tracker.update([{ id: 1, x: 100, y: 100 }], 100);
    expect(firstNudge).toContain(1);

    // nudge 直後、まだクールダウン中 (cooldownMs=500 未満) に同じボールを判定する
    const immediatelyAfter = tracker.update([{ id: 1, x: 100, y: 100 }], 100);
    expect(immediatelyAfter).not.toContain(1);
  });

  it("TC-8: nudge を規定回数繰り返しても停滞が続く場合、それ以上 nudge せず諦める (stall 検知に委ねる)", () => {
    const maxNudgeCount = 3;
    const cooldownMs = 500;
    const tracker = createNudgeTracker({
      minTravelDistance: 20,
      nudgeThresholdMs: NUDGE_THRESHOLD_MS,
      cooldownMs,
      maxNudgeCount,
    });

    let nudgeCount = 0;
    // ボールが一切動かないまま、stall 検知しきい値 (3000ms) を大きく超えるまで判定を続ける
    const totalMs = STALL_DURATION_MS * 3;
    const stepMs = 100;
    for (let elapsed = 0; elapsed < totalMs; elapsed += stepMs) {
      const nudged = tracker.update([{ id: 1, x: 5, y: 5 }], stepMs);
      if (nudged.includes(1)) {
        nudgeCount += 1;
      }
    }

    // 諦めた後は maxNudgeCount を超えて nudge され続けることはない
    expect(nudgeCount).toBe(maxNudgeCount);
  });

  it("追加テスト: forget で追跡状態を破棄すると、以降そのボールは新規扱いになる", () => {
    const tracker = createNudgeTracker({
      minTravelDistance: 20,
      nudgeThresholdMs: NUDGE_THRESHOLD_MS,
      cooldownMs: 500,
      maxNudgeCount: 3,
    });

    for (let i = 0; i < 12; i += 1) {
      tracker.update([{ id: 1, x: 100, y: 100 }], 100);
    }
    tracker.forget(1);

    // forget 直後は新規追跡開始とみなされ、1 回の判定だけでは stalledMs が
    // nudgeThresholdMs に届かないため nudge しない
    const nudged = tracker.update([{ id: 1, x: 100, y: 100 }], 100);
    expect(nudged).not.toContain(1);
  });

  it("追加テスト: samples から消えたボールの内部状態は破棄される (メモリリーク防止)", () => {
    const tracker = createNudgeTracker({
      minTravelDistance: 20,
      nudgeThresholdMs: NUDGE_THRESHOLD_MS,
      cooldownMs: 500,
      maxNudgeCount: 3,
    });

    for (let i = 0; i < 11; i += 1) {
      tracker.update([{ id: 1, x: 100, y: 100 }], 100);
    }
    // 一度 samples から消える (ワールドから除去された想定)
    tracker.update([], 100);
    // 再び同じ id で現れても、内部状態がリセットされているため
    // 1 回の判定だけでは nudge しない
    const nudged = tracker.update([{ id: 1, x: 100, y: 100 }], 100);
    expect(nudged).not.toContain(1);
  });

  it("追加テスト: 不正な入力 (0 以下・非有限の各パラメータ、負の elapsedMs) は例外を投げる", () => {
    expect(() =>
      createNudgeTracker({
        minTravelDistance: 0,
        nudgeThresholdMs: 1200,
        cooldownMs: 500,
        maxNudgeCount: 3,
      })
    ).toThrow();
    expect(() =>
      createNudgeTracker({
        minTravelDistance: 20,
        nudgeThresholdMs: 0,
        cooldownMs: 500,
        maxNudgeCount: 3,
      })
    ).toThrow();
    expect(() =>
      createNudgeTracker({
        minTravelDistance: 20,
        nudgeThresholdMs: 1200,
        cooldownMs: 0,
        maxNudgeCount: 3,
      })
    ).toThrow();
    expect(() =>
      createNudgeTracker({
        minTravelDistance: 20,
        nudgeThresholdMs: 1200,
        cooldownMs: 500,
        maxNudgeCount: 0,
      })
    ).toThrow();
    expect(() =>
      createNudgeTracker({
        minTravelDistance: 20,
        nudgeThresholdMs: 1200,
        cooldownMs: 500,
        maxNudgeCount: 1.5,
      })
    ).toThrow();

    const tracker = createNudgeTracker({
      minTravelDistance: 20,
      nudgeThresholdMs: 1200,
      cooldownMs: 500,
      maxNudgeCount: 3,
    });
    expect(() => tracker.update([{ id: 1, x: 0, y: 0 }], -1)).toThrow();
    expect(() => tracker.update([{ id: 1, x: 0, y: 0 }], Number.NaN)).toThrow();
  });
});
