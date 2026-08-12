import { describe, expect, it } from "vitest";
import { createRng } from "../../lib/random";
import { createBranchGate } from "./branch-gate";
import Matter from "matter-js";
import { createBall } from "../ball";

describe("branch-gate", () => {
  it("createBranchGate でセンサーとフラップが生成される", () => {
    const gate = createBranchGate({ x: 380, y: 165 });
    expect(gate.bodies.length).toBe(2);
    expect(gate.sensor.isSensor).toBe(true);
    expect(gate.flap).toBeDefined();
    expect(typeof gate.update).toBe("function");
  });

  it("センサーに入ったボールに対して左右いずれかの判定を1回だけ行い、速度を変更する", () => {
    const gate = createBranchGate({ x: 380, y: 165, width: 120, height: 100 });
    const engine = Matter.Engine.create();
    const ball = createBall(createRng(1), 380, 165);
    Matter.Body.setVelocity(ball, { x: 3, y: 1 });
    Matter.Composite.add(engine.world, [gate.sensor, gate.flap, ball]);

    const rng = createRng(42);
    const choices: string[] = [];
    gate.update(engine, rng, (side) => choices.push(side));
    gate.update(engine, rng, (side) => choices.push(side));

    expect(choices.length).toBe(1);
    expect(["left", "right"]).toContain(choices[0]);
  });
});
