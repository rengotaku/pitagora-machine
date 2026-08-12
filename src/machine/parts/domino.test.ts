import Matter from "matter-js";
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

  it("reset() で倒れたドミノが起立姿勢 (位置・角度・速度) に戻る (レビュー指摘 #2 回帰テスト)", () => {
    const row = createDominoRow({ x: 700, y: 249, angle: 0.28, count: 3 });
    const original = row.dominoes.map((d) => ({
      x: d.position.x,
      y: d.position.y,
      angle: d.angle,
    }));

    // ドミノが倒れた状態 (角度が大きくずれ、動いている状態) を模す
    for (const domino of row.dominoes) {
      Matter.Body.setPosition(domino, {
        x: domino.position.x + 15,
        y: domino.position.y + 5,
      });
      Matter.Body.setAngle(domino, domino.angle + Math.PI / 2);
      Matter.Body.setVelocity(domino, { x: 3, y: 3 });
      Matter.Body.setAngularVelocity(domino, 2);
    }

    row.reset();

    row.dominoes.forEach((domino, i) => {
      expect(domino.position.x).toBeCloseTo(original[i].x, 5);
      expect(domino.position.y).toBeCloseTo(original[i].y, 5);
      expect(domino.angle).toBeCloseTo(original[i].angle, 5);
      expect(domino.velocity.x).toBeCloseTo(0, 5);
      expect(domino.velocity.y).toBeCloseTo(0, 5);
      expect(domino.angularVelocity).toBeCloseTo(0, 5);
    });
  });

  it("reset() 後は通過検知がクリアされ、同じボールを再び新規通過として検知できる (レビュー指摘 #2 回帰テスト)", () => {
    const row = createDominoRow({ x: 700, y: 249, angle: 0.28, count: 3 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, row.sensor);

    // sensor 中心にボールを直接置き、passedBalls への登録だけを狙う
    const ball = Matter.Bodies.circle(row.sensor.position.x, row.sensor.position.y, 8, {
      label: "ball",
      plugin: { ballData: { id: 777 } },
    });
    Matter.Composite.add(engine.world, ball);

    let passCount = 0;
    row.update(engine, 16.666, () => {
      passCount += 1;
    });
    row.update(engine, 16.666, () => {
      passCount += 1;
    });
    expect(passCount).toBe(1); // 同じボールが sensor 内にいる間は 1 回だけ

    row.reset();

    row.update(engine, 16.666, () => {
      passCount += 1;
    });
    expect(passCount).toBe(2); // reset で記録が消え、再び新規通過として検知される
  });
});
