import { describe, expect, it } from "vitest";
import Matter from "matter-js";
import { createRng } from "../../lib/random";
import { createBall } from "../ball";
import { createBounceFloor } from "./bounce-floor";

describe("bounce-floor", () => {
  it("createBounceFloor で床と通過検知センサーが生成される", () => {
    const floor = createBounceFloor({ x: 850, y: 550, angle: -0.325 });
    expect(floor.bodies.length).toBe(2);
    const main = floor.bodies.find((b) => b.label === "bounce_floor");
    expect(main?.isStatic).toBe(true);
    expect(floor.sensor).toBeDefined();
    expect(floor.sensor.isSensor).toBe(true);
    expect(typeof floor.update).toBe("function");
  });

  it("センサーに入ったボールの速度に開放側への跳ね上げを一度だけ加える", () => {
    const floor = createBounceFloor({ x: 850, y: 550, angle: -0.325, bounceSpeed: 6 });
    const engine = Matter.Engine.create();
    const ball = createBall(createRng(1), 850, 550);
    Matter.Body.setVelocity(ball, { x: 4, y: 1 });
    Matter.Composite.add(engine.world, [floor.sensor, ball]);

    let bounces = 0;
    floor.update(engine, () => {
      bounces += 1;
    });
    const afterFirst = { ...ball.velocity };
    floor.update(engine, () => {
      bounces += 1;
    });

    expect(bounces).toBe(1);
    expect(ball.velocity).toEqual(afterFirst);
  });
});
