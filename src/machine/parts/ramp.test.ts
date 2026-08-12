import { describe, expect, it } from "vitest";
import { createRamp } from "./ramp";

describe("ramp", () => {
  it("createRamp で指定した位置・角度を持ち isStatic な坂 Body が生成される", () => {
    const ramp = createRamp({ x: 400, y: 300, length: 500, angle: 0.2 });
    expect(ramp.isStatic).toBe(true);
    expect(ramp.label).toBe("ramp");
  });
});
