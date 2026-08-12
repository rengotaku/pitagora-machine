import { describe, expect, it } from "vitest";
import { createElevator } from "./elevator";

describe("elevator", () => {
  it("createElevator でエレベーターパーツが生成される", () => {
    const elevator = createElevator({
      bottomY: 760,
      topY: 130,
      x: 300,
    });
    expect(elevator.bodies.length).toBeGreaterThanOrEqual(4);
    expect(elevator.sensor).toBeDefined();
    expect(typeof elevator.update).toBe("function");
  });
});
