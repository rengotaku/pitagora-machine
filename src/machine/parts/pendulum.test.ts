import Matter from "matter-js";
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

  it("reset() で振動位相が 0 に戻り、腕・おもりが静止姿勢の位置に戻る (レビュー指摘 #2 回帰テスト)", () => {
    const pivotX = 520;
    const pivotY = 50;
    const armLength = 78;
    const pendulum = createPendulum({ pivotX, pivotY, armLength, sensorY: 195 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, pendulum.bodies);

    const bob = pendulum.bodies.find((b) => b.label === "pendulum");
    expect(bob).toBeDefined();
    if (!bob) return;

    // 振動させて位相をずらす (周期 2100ms に対して割り切れない経過時間にする)
    for (let i = 0; i < 30; i += 1) {
      pendulum.update(engine, 100);
    }
    expect(bob.position.x).not.toBeCloseTo(pivotX, 1);

    pendulum.reset();

    expect(bob.position.x).toBeCloseTo(pivotX, 3);
    expect(bob.position.y).toBeCloseTo(pivotY + armLength, 3);
  });
});
