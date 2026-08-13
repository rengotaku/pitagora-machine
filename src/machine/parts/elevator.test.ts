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

  it("A-4. キャリアをキネマティック駆動する", () => {
    // 理由: 素の setPosition では velocity が 0 のままで、衝突解決が相対速度を読めず
    // めり込み解消でボールが弾かれるのを防ぐ。
    const bottomY = 760;
    const topY = 130;
    const x = 300;
    const elevator = createElevator({ bottomY, topY, x, speed: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    const ball = createBall(createRng(1), x, bottomY + 10);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, ball);

    elevator.update(engine, 16.666); // waiting_bottom -> moving_up へ遷移
    elevator.update(engine, 16.666); // moving_up で上方向へ位置・速度更新

    const carrierBase = elevator.bodies[1];
    expect(carrierBase.velocity.y).toBeLessThan(0); // 負＝上向きのキネマティック速度を持つこと
  });

  it("A-5. 払い出しの初速が 1 ステップで最大値にならない", () => {
    // 理由: 1 ステップで 8 に飛ぶと画面上で 18px の跳びになる (実測 33 件/分) のを防ぐため
    // 数ステップかけて徐々に立ち上げる。
    const bottomY = 760;
    const topY = 130;
    const x = 300;
    const elevator = createElevator({ bottomY, topY, x, speed: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    const ball = createBall(createRng(2), x, bottomY + 10);
    Matter.Body.setVelocity(ball, { x: 0, y: 0 });
    Matter.Composite.add(engine.world, ball);

    // 最上部 (topY=130) 到達まで update を回す
    for (let i = 0; i < 200; i += 1) {
      elevator.update(engine, 16.666);
      if (ball.velocity.x > 0) break; // dispensing に入って速度が付与されたら抜ける
    }

    // dispensing に入った最初の 1 ステップ目
    const firstVx = ball.velocity.x;
    expect(firstVx).toBeGreaterThan(0);
    expect(firstVx).toBeLessThan(8.0);

    // さらに数ステップ進めると最大値 8.0 に達する
    for (let i = 0; i < 5; i += 1) {
      elevator.update(engine, 16.666);
    }
    expect(ball.velocity.x).toBeCloseTo(8.0, 3);
  });

  it("B-1. 待機中のボールを 1 フレームで大きく移動させない", () => {
    // 理由: 待機床からキャリア内へ一括で 44px ワープさせる問題の回帰テスト。
    const bottomY = 760;
    const topY = 130;
    const x = 300;
    const elevator = createElevator({ bottomY, topY, x, speed: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    // キャリアを上昇させるためにボール 1 を置き、moving_up へ遷移させる
    const ball1 = createBall(createRng(1), x, bottomY + 10);
    Matter.Composite.add(engine.world, ball1);
    elevator.update(engine, 16.666);

    // キャリアが上昇中の待機位置 (bottomY + 54 = 814px 付近) にボール 2 を置く
    const ball2 = createBall(createRng(2), x, bottomY + 54);
    Matter.Composite.add(engine.world, ball2);

    // キャリアが最上部まで行って底に戻るまで追跡
    let prevY = ball2.position.y;
    let maxStepDist = 0;

    for (let i = 0; i < 300; i += 1) {
      elevator.update(engine, 16.666);
      const dy = Math.abs(ball2.position.y - prevY);
      if (dy > maxStepDist) {
        maxStepDist = dy;
      }
      prevY = ball2.position.y;
    }

    // どの 1 ステップでも位置の変化量が 10px を超えないこと
    expect(maxStepDist).toBeLessThanOrEqual(10.0);
  });

  it("B-2 代替. 整列中は衝突が無効化され、完了時に元に戻る", () => {
    // 理由: 待機床からキャリアへの引き込み中に衝突反発が起きないよう mask=0 にし、完了後元に戻す。
    const bottomY = 760;
    const topY = 130;
    const x = 300;
    const elevator = createElevator({ bottomY, topY, x, speed: 300 });
    const engine = Matter.Engine.create();
    Matter.Composite.add(engine.world, elevator.bodies);

    // 待機床上の位置 (bottomY + 50) にボールを置く
    const ball = createBall(createRng(3), x, bottomY + 50);
    const initialMask = ball.collisionFilter.mask;
    expect(initialMask).not.toBe(0);
    Matter.Composite.add(engine.world, ball);

    // 1 回目の update (引き込み整列中)
    elevator.update(engine, 16.666);
    expect(ball.collisionFilter.mask).toBe(0);

    // 整列完了 (y <= bottomY + 10) まで進める
    for (let i = 0; i < 50; i += 1) {
      elevator.update(engine, 16.666);

      if (ball.position.y <= bottomY + 10.001) {
        break;
      }
    }

    // 整列完了後は元の衝突マスクに復元され、目標位置 y = bottomY + 10 に達していること
    expect(ball.collisionFilter.mask).toBe(initialMask);
    expect(ball.position.y).toBeCloseTo(bottomY + 10, 3);
  });
});
