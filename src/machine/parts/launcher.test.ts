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
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
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
    const launcher = createLauncher({ x: 1150, y: 470, launchVx: 12.5, launchVy: -16.5 });
    const engine = Matter.Engine.create();
    const ball = createBall(createRng(2), 1150, 450);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
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
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
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
    expect(ball.velocity.x).toBeLessThan(0.2);
    expect(ball.velocity.y).toBeGreaterThan(-0.1);

    const afterFirstBoost = { ...ball.velocity };

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
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
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
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, [launcher.sensor, ball]);

    let launches = 0;
    launcher.update(engine, 16.666, () => {
      launches += 1;
    });
    expect(launches).toBe(1);

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

  it("1 フレームあたりの移動量が 4px 以下に収まる", () => {
    // 理由: スナップを複数ステップに分割し、1 フレームの移動量を最大 4px に抑えることでワープ (36px 超) を防ぐ。
    const launcher = createLauncher({ x: 1150, y: 470, launchVx: 5.5, launchVy: -4.2 });
    const engine = Matter.Engine.create();
    const initX = 1050;
    const initY = 450; // 発射位置 (1150, 450) から 100px 離れた位置 (センサー内)
    const ball = createBall(createRng(1), initX, initY);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, [launcher.sensor, ball]);

    launcher.update(engine, 16.666);

    const stepDist = Math.hypot(ball.position.x - initX, ball.position.y - initY);
    expect(stepDist).toBeLessThanOrEqual(4.0);
  });

  it("整列中は発射されない", () => {
    // 理由: 発射位置へ最大 4px ずつ整列している間は物理ボールのままで、いきなり射出されないことの検証。
    const launcher = createLauncher({ x: 1150, y: 470, launchVx: 5.5, launchVy: -4.2 });
    const engine = Matter.Engine.create();
    const ball = createBall(createRng(2), 1050, 450);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, [launcher.sensor, ball]);

    let launches = 0;
    launcher.update(engine, 16.666, () => {
      launches += 1;
    });

    expect(launches).toBe(0);
  });

  it("整列が完了すると発射される", () => {
    // 理由: 引き込み整列により発射位置に達したら、元の調整済み初速で発射されることの検証。
    const launcher = createLauncher({ x: 1150, y: 470, launchVx: 5.5, launchVy: -4.2 });
    const engine = Matter.Engine.create();
    const ball = createBall(createRng(3), 1050, 450);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, [launcher.sensor, ball]);

    let launches = 0;
    for (let i = 0; i < 50; i += 1) {
      launcher.update(engine, 16.666, () => {
        launches += 1;
      });
      if (launches > 0) break;
    }

    expect(launches).toBe(1);
    expect(ball.position.x).toBe(1150);
    expect(ball.position.y).toBe(450);
    expect(ball.velocity.x).toBeCloseTo(5.5, 3);
    expect(ball.velocity.y).toBeCloseTo(-4.2, 3);
  });

  it("整列中に衝突が無効化され、発射時に元に戻る", () => {
    // 理由: 引き込み中にシュート等の物理ボディと干渉しないよう mask=0 とし、発射時に元のマスクへ復元する。
    const launcher = createLauncher({ x: 1150, y: 470, launchVx: 5.5, launchVy: -4.2 });
    const engine = Matter.Engine.create();
    const ball = createBall(createRng(4), 1050, 450);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, [launcher.sensor, ball]);

    const initialMask = ball.collisionFilter.mask;
    expect(initialMask).not.toBe(0);

    // 1 回目の update (整列中)
    launcher.update(engine, 16.666);
    expect(ball.collisionFilter.mask).toBe(0);

    // 整列完了まで進める (発射後)
    let launches = 0;
    for (let i = 0; i < 50; i += 1) {
      launcher.update(engine, 16.666, () => {
        launches += 1;
      });
      if (launches > 0) break;
    }

    expect(launches).toBe(1);
    expect(ball.collisionFilter.mask).toBe(initialMask);
  });
});
