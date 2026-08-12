import Matter from "matter-js";
import { describe, expect, it } from "vitest";
import { createRng } from "../../lib/random";
import { createBall } from "../ball";
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

  it("reset() でキャリアが底の待機位置に戻り、運搬待ち記録も破棄される (レビュー指摘 #2 回帰テスト)", () => {
    const bottomY = 760;
    const topY = 130;
    const x = 300;
    const elevator = createElevator({ bottomY, topY, x, speed: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    // bodies = [rail, carrierBase, carrierLeftWall, carrierRightWall, waitingFloor, sensor]
    const carrierBase = elevator.bodies[1];
    expect(carrierBase.label).toBe("elevator_carrier");
    expect(carrierBase.position.y).toBeCloseTo(bottomY + 24, 3);

    // carrier の判定範囲内にボールを置き、moving_up へ遷移させて上昇させる
    const ball = createBall(createRng(1), x, bottomY + 10);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, ball);

    elevator.update(engine, 16.666); // waiting_bottom: ball を検知して moving_up へ
    elevator.update(engine, 500); // moving_up: currentY が上昇する

    expect(carrierBase.position.y).toBeLessThan(bottomY + 24 - 50);

    const ballId = (ball.plugin as { ballData?: { id: number } }).ballData?.id;
    expect(ballId).toBeDefined();
    if (ballId !== undefined) {
      expect(elevator.isHolding(ballId)).toBe(true);
    }

    elevator.reset();

    expect(carrierBase.position.y).toBeCloseTo(bottomY + 24, 3);
    if (ballId !== undefined) {
      expect(elevator.isHolding(ballId)).toBe(false);
    }
  });
});
