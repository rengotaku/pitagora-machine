import { describe, expect, it } from "vitest";
import Matter from "matter-js";
import { createRng } from "../../lib/random";
import { createBall } from "../ball";
import { createLauncher } from "./launcher";

describe("launcher", () => {
  it("createLauncher で右上発射装置が生成される", () => {
    const launcher = createLauncher({
      x: 1150,
      y: 470,
      launchVx: 12.5,
      launchVy: -16.5,
    });
    expect(launcher.bodies.length).toBeGreaterThanOrEqual(2);
    expect(launcher.sensor).toBeDefined();
    expect(typeof launcher.update).toBe("function");
  });

  it("sensor に入ったボールを右上へ発射する", () => {
    const launcher = createLauncher({ x: 1150, y: 470, launchVx: 12.5, launchVy: -16.5 });
    const engine = Matter.Engine.create();
    const ball = createBall(createRng(1), 1150, 450);
    Matter.Composite.add(engine.world, [launcher.sensor, ball]);

    let launches = 0;
    launcher.update(engine, 16.666, () => {
      launches += 1;
    });

    expect(launches).toBe(1);
    expect(ball.velocity.x).toBeCloseTo(12.5, 3);
    expect(ball.velocity.y).toBeCloseTo(-16.5, 3);
  });

  it("sensor 内に留まり続け発射に失敗したボールは、タイムアウト後に再発射される", () => {
    // sensor から出られないまま (backWall に跳ね返された等を想定し、位置を固定) だと
    // 二度と再発射されない詰まりになっていたための回帰テスト。
    const launcher = createLauncher({ x: 1150, y: 470, launchVx: 12.5, launchVy: -16.5 });
    const engine = Matter.Engine.create();
    const ball = createBall(createRng(2), 1150, 450);
    Matter.Composite.add(engine.world, [launcher.sensor, ball]);

    let launches = 0;
    // 1 回目: 発射される
    launcher.update(engine, 16.666, () => {
      launches += 1;
    });
    expect(launches).toBe(1);

    // sensor 内に留まり続けているとみなし、位置を sensor 内に戻したまま
    // 合計 1500ms 以上 update を呼ぶ (タイムアウトで再発射対象に戻るはず)
    Matter.Body.setPosition(ball, { x: 1150, y: 450 });
    for (let i = 0; i < 10; i += 1) {
      Matter.Body.setPosition(ball, { x: 1150, y: 450 });
      launcher.update(engine, 200, () => {
        launches += 1;
      });
    }

    expect(launches).toBe(2);
  });

  it("landingAngle 指定時、発射後に減速したボールへ坂の下り方向の着地加速を 1 回だけ与える", () => {
    const launcher = createLauncher({
      x: 1150,
      y: 470,
      launchVx: 5.5,
      launchVy: -4.2,
      landingAngle: -0.325,
      landingBoostTriggerSpeed: 3.0,
      landingBoostSpeed: 3.5,
    });
    const engine = Matter.Engine.create();
    const ball = createBall(createRng(3), 1150, 450);
    Matter.Composite.add(engine.world, [launcher.sensor, ball]);

    let launches = 0;
    let boosts = 0;
    launcher.update(
      engine,
      16.666,
      () => {
        launches += 1;
      },
      () => {
        boosts += 1;
      }
    );
    expect(launches).toBe(1);

    // sensor の外・着地点付近を模した低速状態に置き、猶予時間 (300ms) を超えて経過させる
    Matter.Body.setPosition(ball, { x: 1216, y: 413 });
    Matter.Body.setVelocity(ball, { x: 0.2, y: -0.1 });
    launcher.update(
      engine,
      350,
      () => {
        launches += 1;
      },
      () => {
        boosts += 1;
      }
    );

    expect(boosts).toBe(1);
    // 下り方向 (左下、x 減少・y 増加) への加速が加わっているはず
    expect(ball.velocity.x).toBeLessThan(0.2);
    expect(ball.velocity.y).toBeGreaterThan(-0.1);

    const afterFirstBoost = { ...ball.velocity };

    // 再度同じ低速状態でも、1 回加速済みなら二度と加速しない
    Matter.Body.setVelocity(ball, { x: 0.2, y: -0.1 });
    launcher.update(
      engine,
      350,
      () => {
        launches += 1;
      },
      () => {
        boosts += 1;
      }
    );
    expect(boosts).toBe(1);
    expect(afterFirstBoost).toBeDefined();
  });

  it("landingAngle 未指定なら着地加速を行わない", () => {
    const launcher = createLauncher({ x: 1150, y: 470, launchVx: 5.5, launchVy: -4.2 });
    const engine = Matter.Engine.create();
    const ball = createBall(createRng(4), 1150, 450);
    Matter.Composite.add(engine.world, [launcher.sensor, ball]);

    launcher.update(engine, 16.666, undefined, undefined);

    Matter.Body.setPosition(ball, { x: 1216, y: 413 });
    Matter.Body.setVelocity(ball, { x: 0.2, y: -0.1 });

    let boosts = 0;
    launcher.update(
      engine,
      350,
      () => {},
      () => {
        boosts += 1;
      }
    );

    expect(boosts).toBe(0);
  });

  it("reset() で発射済み記録がクリアされ、sensor 内に留まるボールが即座に再発射対象に戻る (レビュー指摘 #2 回帰テスト)", () => {
    const launcher = createLauncher({ x: 1150, y: 470, launchVx: 12.5, launchVy: -16.5 });
    const engine = Matter.Engine.create();
    const ball = createBall(createRng(1), 1150, 450);
    Matter.Composite.add(engine.world, [launcher.sensor, ball]);

    let launches = 0;
    launcher.update(engine, 16.666, () => {
      launches += 1;
    });
    expect(launches).toBe(1);

    // sensor 内に留まったまま reset せずに update しても、タイムアウト (1500ms) 前
    // なので再発射されない
    Matter.Body.setPosition(ball, { x: 1150, y: 450 });
    launcher.update(engine, 16.666, () => {
      launches += 1;
    });
    expect(launches).toBe(1);

    launcher.reset();

    Matter.Body.setPosition(ball, { x: 1150, y: 450 });
    launcher.update(engine, 16.666, () => {
      launches += 1;
    });
    expect(launches).toBe(2);
  });
});
