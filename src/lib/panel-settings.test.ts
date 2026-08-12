import { describe, expect, it } from "vitest";
import {
  BALL_COUNT_DEFAULT,
  BALL_COUNT_MAX,
  BALL_COUNT_MIN,
  clampBallCount,
  clampGravity,
  clampSpeedScale,
  getDefaultSettings,
  GRAVITY_DEFAULT,
  GRAVITY_MAX,
  GRAVITY_MIN,
  SPEED_SCALE_DEFAULT,
  SPEED_SCALE_MAX,
  SPEED_SCALE_MIN,
} from "./panel-settings";

describe("panel-settings (TC-1 ~ TC-6)", () => {
  it("TC-1: 重力の範囲が 0〜2、3 を渡すと 2 にクランプされる", () => {
    expect(clampGravity(3)).toBe(2);
  });

  it("TC-2: 重力の範囲が 0〜2、-1 を渡すと 0 にクランプされる", () => {
    expect(clampGravity(-1)).toBe(0);
  });

  it("TC-3: 重力に NaN / undefined / 文字列を渡すと既定値にフォールバックする", () => {
    expect(clampGravity(NaN)).toBe(GRAVITY_DEFAULT);
    expect(clampGravity(undefined)).toBe(GRAVITY_DEFAULT);
    expect(clampGravity("abc")).toBe(GRAVITY_DEFAULT);
  });

  it("TC-4: ボール数の範囲が 1〜12、0 を渡すと 1 にクランプされる", () => {
    expect(clampBallCount(0)).toBe(1);
  });

  it("TC-5: 速度の範囲が 0.25〜2、0 を渡すと 0.25 にクランプされる", () => {
    expect(clampSpeedScale(0)).toBe(0.25);
  });

  it("TC-6: すべての項目の既定値を取得すると各範囲内に収まっている", () => {
    const defaults = getDefaultSettings();
    expect(defaults.gravity).toBeGreaterThanOrEqual(GRAVITY_MIN);
    expect(defaults.gravity).toBeLessThanOrEqual(GRAVITY_MAX);
    expect(defaults.ballCount).toBeGreaterThanOrEqual(BALL_COUNT_MIN);
    expect(defaults.ballCount).toBeLessThanOrEqual(BALL_COUNT_MAX);
    expect(defaults.speedScale).toBeGreaterThanOrEqual(SPEED_SCALE_MIN);
    expect(defaults.speedScale).toBeLessThanOrEqual(SPEED_SCALE_MAX);
  });

  it("追加テスト: 範囲内の値はクランプされずそのまま返る / 正常系の分岐カバレッジ確認のため", () => {
    expect(clampGravity(1.5)).toBe(1.5);
    expect(clampBallCount(6)).toBe(6);
    expect(clampSpeedScale(1.25)).toBe(1.25);
  });

  it("追加テスト: ボール数の上限超え (13) は 12 にクランプされる / Math.min 側の分岐カバレッジ確認のため", () => {
    expect(clampBallCount(13)).toBe(BALL_COUNT_MAX);
  });

  it("追加テスト: 速度の上限超え (3) は 2 にクランプされる / Math.min 側の分岐カバレッジ確認のため", () => {
    expect(clampSpeedScale(3)).toBe(SPEED_SCALE_MAX);
  });

  it("追加テスト: ボール数に NaN / undefined / 文字列を渡すと既定値にフォールバックする / clampBallCount 単体の型ガード確認のため", () => {
    expect(clampBallCount(NaN)).toBe(BALL_COUNT_DEFAULT);
    expect(clampBallCount(undefined)).toBe(BALL_COUNT_DEFAULT);
    expect(clampBallCount("abc")).toBe(BALL_COUNT_DEFAULT);
  });

  it("追加テスト: 速度に NaN / undefined / 文字列を渡すと既定値にフォールバックする / clampSpeedScale 単体の型ガード確認のため", () => {
    expect(clampSpeedScale(NaN)).toBe(SPEED_SCALE_DEFAULT);
    expect(clampSpeedScale(undefined)).toBe(SPEED_SCALE_DEFAULT);
    expect(clampSpeedScale("abc")).toBe(SPEED_SCALE_DEFAULT);
  });

  it("追加テスト: ボール数は小数を渡すと整数へ丸められる / UI の range input が小数を渡す可能性への防御", () => {
    expect(clampBallCount(5.6)).toBe(6);
  });
});
