import { describe, expect, it } from "vitest";
import { createWheel } from "./wheel";

describe("wheel", () => {
  it("createWheel で回転ホイールと通過検知センサーが生成される", () => {
    const wheel = createWheel({ x: 650, y: 558, sensorY: 615 });
    expect(wheel.bodies.length).toBeGreaterThanOrEqual(3);
    const hub = wheel.bodies.find((b) => b.label === "wheel");
    expect(hub?.isStatic).toBe(true);
    expect(wheel.sensor).toBeDefined();
    expect(wheel.sensor.isSensor).toBe(true);
    expect(typeof wheel.update).toBe("function");
  });
});
