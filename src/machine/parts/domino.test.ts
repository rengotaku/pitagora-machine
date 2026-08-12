import { describe, expect, it } from "vitest";
import { createDominoRow } from "./domino";

describe("domino", () => {
  it("createDominoRow で指定枚数のドミノとプラットフォーム・通過検知センサーが生成される", () => {
    const row = createDominoRow({ x: 700, y: 249, angle: 0.28, count: 5 });
    expect(row.dominoes.length).toBe(5);
    // bodies = platform + dominoes(5) + sensor
    expect(row.bodies.length).toBe(7);
    for (const domino of row.dominoes) {
      expect(domino.isStatic).toBe(false);
      expect(domino.label).toBe("domino");
    }
    expect(row.sensor).toBeDefined();
    expect(row.sensor.isSensor).toBe(true);
    expect(typeof row.update).toBe("function");
  });
});
