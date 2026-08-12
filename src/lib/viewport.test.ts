import { describe, expect, it } from "vitest";
import { fitWorldToCanvas, screenToWorld } from "./viewport";

describe("fitWorldToCanvas", () => {
  it("アスペクト比が一致していれば余白なしで拡大する", () => {
    const t = fitWorldToCanvas(1600, 900, 3200, 1800);
    expect(t.scale).toBe(2);
    expect(t.offsetX).toBe(0);
    expect(t.offsetY).toBe(0);
  });

  it("キャンバスが横長なら左右に均等な余白を作る", () => {
    const t = fitWorldToCanvas(1600, 900, 2000, 900);
    expect(t.scale).toBe(1);
    expect(t.offsetX).toBe(200);
    expect(t.offsetY).toBe(0);
  });

  it("キャンバスが縦長なら上下に均等な余白を作る", () => {
    const t = fitWorldToCanvas(1600, 900, 1600, 1100);
    expect(t.scale).toBe(1);
    expect(t.offsetX).toBe(0);
    expect(t.offsetY).toBe(100);
  });

  it("ワールド全体が必ずキャンバス内に収まる", () => {
    const t = fitWorldToCanvas(1600, 900, 1280, 1024);
    expect(1600 * t.scale + t.offsetX * 2).toBeLessThanOrEqual(1280 + 1e-9);
    expect(900 * t.scale + t.offsetY * 2).toBeLessThanOrEqual(1024 + 1e-9);
  });

  it("0 以下や非有限のサイズを拒否する", () => {
    expect(() => fitWorldToCanvas(0, 900, 100, 100)).toThrow(/worldWidth/);
    expect(() => fitWorldToCanvas(1600, -1, 100, 100)).toThrow(/worldHeight/);
    expect(() => fitWorldToCanvas(1600, 900, 0, 100)).toThrow(/canvasWidth/);
    expect(() => fitWorldToCanvas(1600, 900, 100, Number.NaN)).toThrow(/canvasHeight/);
  });
});

describe("screenToWorld", () => {
  it("fitWorldToCanvas の逆変換になっている", () => {
    const t = fitWorldToCanvas(1600, 900, 2000, 900);
    expect(screenToWorld(t, t.offsetX, t.offsetY)).toEqual({ x: 0, y: 0 });
    expect(screenToWorld(t, t.offsetX + 1600, t.offsetY + 900)).toEqual({
      x: 1600,
      y: 900,
    });
  });
});
