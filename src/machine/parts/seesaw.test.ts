import Matter from "matter-js";
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

  it("reset() で板とカウンターウェイトが初期姿勢・静止速度に戻る (レビュー指摘 #2 回帰テスト)", () => {
    const x = 900;
    const y = 360;
    const seesaw = createSeesaw({ x, y, length: 260 });

    const originalBoardPos = { ...seesaw.board.position };
    const originalBoardAngle = seesaw.board.angle;
    const counterWeight = seesaw.bodies.find((b) => b.label === "seesaw_weight");
    expect(counterWeight).toBeDefined();
    if (!counterWeight) return;
    const originalWeightPos = { ...counterWeight.position };

    // ボールがぶつかって傾いた状態を模す
    Matter.Body.setPosition(seesaw.board, { x: x + 20, y: y - 30 });
    Matter.Body.setAngle(seesaw.board, 0.5);
    Matter.Body.setVelocity(seesaw.board, { x: 5, y: -5 });
    Matter.Body.setAngularVelocity(seesaw.board, 1.2);

    Matter.Body.setPosition(counterWeight, { x: x - 60, y: y + 60 });
    Matter.Body.setVelocity(counterWeight, { x: 2, y: 2 });
    Matter.Body.setAngularVelocity(counterWeight, 0.8);

    seesaw.reset();

    expect(seesaw.board.position.x).toBeCloseTo(originalBoardPos.x, 5);
    expect(seesaw.board.position.y).toBeCloseTo(originalBoardPos.y, 5);
    expect(seesaw.board.angle).toBeCloseTo(originalBoardAngle, 5);
    expect(seesaw.board.velocity.x).toBeCloseTo(0, 5);
    expect(seesaw.board.velocity.y).toBeCloseTo(0, 5);
    expect(seesaw.board.angularVelocity).toBeCloseTo(0, 5);

    expect(counterWeight.position.x).toBeCloseTo(originalWeightPos.x, 5);
    expect(counterWeight.position.y).toBeCloseTo(originalWeightPos.y, 5);
    expect(counterWeight.velocity.x).toBeCloseTo(0, 5);
    expect(counterWeight.velocity.y).toBeCloseTo(0, 5);
    expect(counterWeight.angularVelocity).toBeCloseTo(0, 5);
  });
});
