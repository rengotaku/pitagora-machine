import { describe, expect, it } from "vitest";
import { createPendulum } from "./pendulum";

describe("pendulum", () => {
  it("createPendulum で振り子と通過検知センサーが生成される", () => {
    const pendulum = createPendulum({ pivotX: 520, pivotY: 50, sensorY: 195 });
    expect(pendulum.bodies.length).toBeGreaterThanOrEqual(3);
    const bob = pendulum.bodies.find((b) => b.label === "pendulum");
    expect(bob?.isStatic).toBe(true);
    expect(pendulum.sensor).toBeDefined();
    expect(pendulum.sensor.isSensor).toBe(true);
    expect(typeof pendulum.update).toBe("function");
  });
});
