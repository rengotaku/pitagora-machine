import { describe, expect, it } from "vitest";
import { shouldRecoverDominoes } from "./domino-recovery";

describe("domino-recovery (TC-5 ~ TC-8)", () => {
  it("TC-5: 5 枚中 0 枚が倒れているとき、復帰不要と判定する", () => {
    const result = shouldRecoverDominoes({
      fallenCount: 0,
      totalCount: 5,
      msSinceLastContact: 10000,
      recoveryWaitMs: 2000,
    });
    expect(result).toBe(false);
  });

  it("TC-6: 5 枚中 3 枚が倒れ、最後の接触から復帰待機時間が経過していれば復帰する", () => {
    expect(
      shouldRecoverDominoes({
        fallenCount: 3,
        totalCount: 5,
        msSinceLastContact: 2000,
        recoveryWaitMs: 2000,
      })
    ).toBe(true);
    expect(
      shouldRecoverDominoes({
        fallenCount: 3,
        totalCount: 5,
        msSinceLastContact: 5000,
        recoveryWaitMs: 2000,
      })
    ).toBe(true);
  });

  it("TC-7: 5 枚中 3 枚が倒れているが、直前までボールが接触していたら復帰しない (連鎖中に起こし直さない)", () => {
    expect(
      shouldRecoverDominoes({
        fallenCount: 3,
        totalCount: 5,
        msSinceLastContact: 0,
        recoveryWaitMs: 2000,
      })
    ).toBe(false);
    expect(
      shouldRecoverDominoes({
        fallenCount: 3,
        totalCount: 5,
        msSinceLastContact: 1999,
        recoveryWaitMs: 2000,
      })
    ).toBe(false);
  });

  it("TC-8: 全枚数が倒れていれば、直前の接触に関わらず復帰する", () => {
    expect(
      shouldRecoverDominoes({
        fallenCount: 5,
        totalCount: 5,
        msSinceLastContact: 0,
        recoveryWaitMs: 2000,
      })
    ).toBe(true);
  });

  it("追加テスト: 不正な入力 (範囲外・NaN・負値・0以下) は例外を投げる / 他のlib関数と同水準の防御的検証", () => {
    expect(() =>
      shouldRecoverDominoes({
        fallenCount: -1,
        totalCount: 5,
        msSinceLastContact: 0,
        recoveryWaitMs: 2000,
      })
    ).toThrow();
    expect(() =>
      shouldRecoverDominoes({
        fallenCount: 6,
        totalCount: 5,
        msSinceLastContact: 0,
        recoveryWaitMs: 2000,
      })
    ).toThrow();
    expect(() =>
      shouldRecoverDominoes({
        fallenCount: 0,
        totalCount: 0,
        msSinceLastContact: 0,
        recoveryWaitMs: 2000,
      })
    ).toThrow();
    expect(() =>
      shouldRecoverDominoes({
        fallenCount: 0,
        totalCount: 5,
        msSinceLastContact: Number.NaN,
        recoveryWaitMs: 2000,
      })
    ).toThrow();
    expect(() =>
      shouldRecoverDominoes({
        fallenCount: 0,
        totalCount: 5,
        msSinceLastContact: -1,
        recoveryWaitMs: 2000,
      })
    ).toThrow();
    expect(() =>
      shouldRecoverDominoes({
        fallenCount: 0,
        totalCount: 5,
        msSinceLastContact: 0,
        recoveryWaitMs: 0,
      })
    ).toThrow();
  });
});
