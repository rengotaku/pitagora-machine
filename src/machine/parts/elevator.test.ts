import Matter from "matter-js";
import { describe, expect, it } from "vitest";
import { createRng } from "../../lib/random";
import { createBall } from "../ball";
import { createElevator } from "./elevator";

describe("elevator", () => {
  it("createElevator でエレベーターパーツが生成される", () => {
    const elevator = createElevator({
      bottomY: 740,
      topY: 120,
      x: 300,
    });
    expect(elevator.bodies.length).toBeGreaterThanOrEqual(4);
    expect(elevator.sensor).toBeDefined();
    expect(typeof elevator.update).toBe("function");
  });

  it("reset() でキャリアが底の待機位置に戻り、運搬待ち記録も破棄される (レビュー指摘 #2 回帰テスト)", () => {
    const bottomY = 740;
    const topY = 120;
    const x = 300;
    const elevator = createElevator({ bottomY, topY, x, speed: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    // bodies = [rail, carrierBase, carrierLeftWall, carrierRightWall, waitingFloor, sensor, ...]
    const carrierBase = elevator.bodies[1];
    expect(carrierBase.label).toBe("elevator_carrier");
    expect(carrierBase.position.y).toBeCloseTo(bottomY + 24, 3);

    // carrier の判定範囲内にボールを置き、moving_up へ遷移させて上昇させる
    const ball = createBall(createRng(1), x, bottomY + 10);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, ball);

    // まとめ積みの待ち時間 (450ms) を過ぎてから発車するので、検知だけでは上昇しない
    elevator.update(engine, 16.666); // waiting_bottom: ball を検知（待ち時間の計測開始）
    elevator.update(engine, 500); // waiting_bottom: 待ち時間を超えて moving_up へ
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

  it("A-4. キャリアをキネマティック駆動する", () => {
    const bottomY = 740;
    const topY = 120;
    const x = 300;
    const elevator = createElevator({ bottomY, topY, x, speed: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    const ball = createBall(createRng(1), x, bottomY + 10);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, ball);

    // まとめ積みの待ち時間 (450ms) を過ぎてから発車する
    elevator.update(engine, 16.666); // waiting_bottom: ball を検知（待ち時間の計測開始）
    elevator.update(engine, 500); // waiting_bottom -> moving_up へ遷移
    elevator.update(engine, 16.666); // moving_up で上方向へ位置・速度更新

    const carrierBase = elevator.bodies[1];
    expect(carrierBase.velocity.y).toBeLessThan(0); // 負＝上向きのキネマティック速度を持つこと
  });

  it("A-5. 払い出しの初速が 1 ステップで最大値にならない", () => {
    const bottomY = 740;
    const topY = 120;
    const x = 300;
    const elevator = createElevator({ bottomY, topY, x, speed: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    const ball = createBall(createRng(2), x, bottomY + 10);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, ball);

    for (let i = 0; i < 200; i += 1) {
      Matter.Engine.update(engine, 16.666);
      elevator.update(engine, 16.666);
      if (ball.velocity.x > 0) break;
    }

    const firstVx = ball.velocity.x;
    expect(firstVx).toBeGreaterThan(0);
    expect(firstVx).toBeLessThan(8.0);

    for (let i = 0; i < 5; i += 1) {
      Matter.Engine.update(engine, 16.666);
      elevator.update(engine, 16.666);
    }
    expect(ball.velocity.x).toBeCloseTo(8.0, 3);
  });

  it("ゲートの開閉時にホッパー床との隙間条件 (開: 45px以上, 閉: 15px以下) を満たす", () => {
    const elevator = createElevator({ bottomY: 740, topY: 120, x: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    const hopperFloor = elevator.bodies.find((b) => b.label === "elevator_hopper_floor")!;
    const gate = elevator.bodies.find((b) => b.label === "elevator_gate")!;

    const getMinDistanceToHopperFloor = (): number => {
      const floorAngle = hopperFloor.angle;
      const nx = Math.sin(floorAngle);
      const ny = -Math.cos(floorAngle);
      const px = hopperFloor.position.x + 6 * nx;
      const py = hopperFloor.position.y + 6 * ny;

      let minDist = Infinity;
      for (const v of gate.vertices) {
        const dist = (v.x - px) * nx + (v.y - py) * ny;
        if (dist < minDist) minDist = dist;
      }
      return minDist;
    };

    // 閉じた状態 (reset後)
    elevator.reset();
    const closedDist = getMinDistanceToHopperFloor();
    expect(closedDist).toBeLessThanOrEqual(15);

    // 開いた状態 (waiting_bottom での update)
    elevator.update(engine, 16.666);
    const openDist = getMinDistanceToHopperFloor();
    expect(openDist).toBeGreaterThanOrEqual(45);
  });

  it("出口シュートの面が x 368..382 の範囲で、キャリア右壁の上端より上にある", () => {
    const bottomY = 740;
    const elevator = createElevator({ bottomY, topY: 120, x: 300 });

    const carrierRightWall = elevator.bodies[3]; // rectangle(x + 75, currentY + 12, 14, 44)
    const exitChute = elevator.bodies.find((b) => b.label === "elevator_exit_chute")!;

    // 停車時の右壁上端 y: currentY = 740, 中心 y = 752, 高さ 44 -> 上端 y = 730
    const rightWallTopY = carrierRightWall.position.y - 22; // 730

    // 出口シュートの上面 y(x) の評価
    const chuteAngle = exitChute.angle;
    const nx = Math.sin(chuteAngle);
    const ny = -Math.cos(chuteAngle);
    const px = exitChute.position.x + 6 * nx;
    const py = exitChute.position.y + 6 * ny;

    for (let x = 368; x <= 382; x += 1) {
      const chuteSurfaceY = py - ((x - px) * nx) / ny;
      // y 座標は画面上方向ほど小さい。シュート面 y < 右壁上端 y
      expect(chuteSurfaceY).toBeLessThan(rightWallTopY);
    }
  });

  it("1 周ぶん update を回し、位置の変化量が 10px を超えず collisionFilter.mask が 0 になる瞬間が無い", () => {
    const bottomY = 740;
    const topY = 120;
    const x = 300;
    const elevator = createElevator({ bottomY, topY, x, speed: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    // ホッパー床上付近 (450, 680) にボールを配置
    const ball = createBall(createRng(1), 450, 680);
    Matter.Composite.add(engine.world, ball);

    let prevPos = { ...ball.position };
    let maxStepDist = 0;

    for (let i = 0; i < 300; i += 1) {
      Matter.Engine.update(engine, 16.666);
      elevator.update(engine, 16.666);

      const dist = Math.hypot(ball.position.x - prevPos.x, ball.position.y - prevPos.y);
      if (dist > maxStepDist) {
        maxStepDist = dist;
      }
      prevPos = { ...ball.position };

      expect(ball.collisionFilter.mask).not.toBe(0);
    }

    expect(maxStepDist).toBeLessThanOrEqual(10.0);
  });

  it("ホッパー床の勾配が十分にある (絶対値 0.15 以上)", () => {
    const elevator = createElevator({ bottomY: 740, topY: 120, x: 300 });
    const hopperFloor = elevator.bodies.find((b) => b.label === "elevator_hopper_floor")!;
    expect(Math.abs(hopperFloor.angle)).toBeGreaterThanOrEqual(0.15);
  });

  it("実エンジンでホッパー上のボールがゲートまで転がる", () => {
    const elevator = createElevator({ bottomY: 740, topY: 120, x: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    // ホッパー床の右寄り (460, 680) に静止状態でボールを配置
    const ball = createBall(createRng(1), 460, 680);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, ball);

    const startX = ball.position.x;

    // 物理シミュレーションを 80 ステップ進める
    for (let i = 0; i < 80; i += 1) {
      Matter.Engine.update(engine, 16.666);
      elevator.update(engine, 16.666);
    }

    // ボールの x 座標がゲート側 (左) へ有意に移動していること
    expect(ball.position.x).toBeLessThan(startX - 15);
  });

  it("ホッパーで待つボールが運搬待ち (isHolding) として報告される", () => {
    const elevator = createElevator({ bottomY: 740, topY: 120, x: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    // ホッパー床の上 (x=450, y=680) にボールを配置
    const ball = createBall(createRng(1), 450, 680);
    Matter.Composite.add(engine.world, ball);

    // 1 回 update を呼ぶ
    elevator.update(engine, 16.666);

    const ballId = (ball.plugin as { ballData?: { id: number } })?.ballData?.id;
    expect(ballId).toBeDefined();
    if (ballId !== undefined) {
      expect(elevator.isHolding(ballId)).toBe(true);
    }
  });
});
