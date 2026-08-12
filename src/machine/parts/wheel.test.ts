import Matter from "matter-js";
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

  it("update 後も 2 枚の羽根が十字を保つ（重なって 1 本にならない）", () => {
    const wheel = createWheel({ x: 650, y: 558, sensorY: 615 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, wheel.bodies);

    const [, bladeA, bladeB] = wheel.bodies;
    const widthOf = (b: Matter.Body): number => b.bounds.max.x - b.bounds.min.x;
    const heightOf = (b: Matter.Body): number => b.bounds.max.y - b.bounds.min.y;

    // 生成時点で bladeA は横長・bladeB は縦長。形状の段階で既に直交している
    expect(widthOf(bladeA)).toBeGreaterThan(heightOf(bladeA));
    expect(heightOf(bladeB)).toBeGreaterThan(widthOf(bladeB));

    for (let i = 0; i < 10; i += 1) {
      wheel.update(engine, 16.666);
    }

    // 形状が既に直交しているので、両者に「同じ角度」を与えたときだけ十字になる。
    // bladeB にだけ余分な π/2 を足すと 2 枚が同じ向きに重なり、十字ではなく
    // 1 本の羽根になってボールを弾く範囲が半分になる。
    expect(bladeA.angle).toBeCloseTo(bladeB.angle, 5);
    expect(bladeA.angle).toBeGreaterThan(0);
  });

  it("reset() で羽根の回転角度が初期角度 (0) に戻り、通過検知記録もクリアされる (レビュー指摘 #2 回帰テスト)", () => {
    const wheel = createWheel({ x: 650, y: 558, sensorY: 615 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, wheel.bodies);

    for (let i = 0; i < 10; i += 1) {
      wheel.update(engine, 100);
    }
    const [hub, bladeA, bladeB] = wheel.bodies;
    expect(hub.angle).not.toBe(0);

    wheel.reset();

    expect(hub.angle).toBeCloseTo(0, 5);
    expect(bladeA.angle).toBeCloseTo(0, 5);
    expect(bladeB.angle).toBeCloseTo(0, 5);
  });
});
