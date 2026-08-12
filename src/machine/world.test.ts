import { describe, expect, it } from "vitest";
import Matter from "matter-js";
import { createPitagoraWorld } from "./world";

describe("world", () => {
  it("createPitagoraWorld で Engine が作成され、外周の壁と床が配置される", () => {
    const { engine } = createPitagoraWorld();
    expect(engine).toBeDefined();

    const bodies = Matter.Composite.allBodies(engine.world);
    expect(bodies.length).toBeGreaterThanOrEqual(3);

    const labels = bodies.map((b) => b.label);
    expect(labels).toContain("ground");
    expect(labels.filter((l) => l === "wall").length).toBeGreaterThanOrEqual(2);

    // 外周ボディがすべて isStatic であることを確認
    for (const body of bodies) {
      expect(body.isStatic).toBe(true);
    }
  });
});
