import { describe, expect, it } from "vitest";
import { createSeesaw } from "./seesaw";

describe("seesaw", () => {
  it("createSeesaw で静止時左下がりのシーソーが生成される", () => {
    const seesaw = createSeesaw({ x: 900, y: 360, length: 260 });
    expect(seesaw.bodies.length).toBeGreaterThanOrEqual(4);
    expect(seesaw.constraints.length).toBeGreaterThanOrEqual(1);
    expect(seesaw.board).toBeDefined();
    expect(seesaw.sensor).toBeDefined();
  });
});
