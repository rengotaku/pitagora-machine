import { describe, expect, it } from "vitest";
import { createBallTrailTracker } from "./ball-trail";

describe("ball-trail", () => {
  it("履歴を追加し、取得できる", () => {
    const tracker = createBallTrailTracker({ maxPoints: 5 });
    tracker.addPoint(1, { x: 10, y: 20 });
    tracker.addPoint(1, { x: 15, y: 25 });

    expect(tracker.getTrail(1)).toEqual([
      { x: 10, y: 20 },
      { x: 15, y: 25 },
    ]);
  });

  it("上限 (maxPoints) を超えたら古い履歴が間引かれる", () => {
    const tracker = createBallTrailTracker({ maxPoints: 3 });
    tracker.addPoint(1, { x: 1, y: 1 });
    tracker.addPoint(1, { x: 2, y: 2 });
    tracker.addPoint(1, { x: 3, y: 3 });
    tracker.addPoint(1, { x: 4, y: 4 });

    expect(tracker.getTrail(1)).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ]);
  });

  it("forget(id) で指定したボールの履歴が破棄される", () => {
    const tracker = createBallTrailTracker();
    tracker.addPoint(1, { x: 10, y: 20 });
    tracker.addPoint(2, { x: 30, y: 40 });

    tracker.forget(1);

    expect(tracker.getTrail(1)).toEqual([]);
    expect(tracker.getTrail(2)).toEqual([{ x: 30, y: 40 }]);
  });

  it("clear() で全ボールの履歴がクリアされる", () => {
    const tracker = createBallTrailTracker();
    tracker.addPoint(1, { x: 10, y: 20 });
    tracker.addPoint(2, { x: 30, y: 40 });

    tracker.clear();

    expect(tracker.getTrail(1)).toEqual([]);
    expect(tracker.getTrail(2)).toEqual([]);
    expect(tracker.getAllTrails().size).toBe(0);
  });

  it("存在しない id や空の状態で空配列を返す", () => {
    const tracker = createBallTrailTracker();
    expect(tracker.getTrail(999)).toEqual([]);
  });
});
