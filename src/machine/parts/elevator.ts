import Matter from "matter-js";

export interface ElevatorOptions {
  x?: number;
  bottomY?: number;
  topY?: number;
  speed?: number;
  color?: string;
}

export interface ElevatorComponent {
  bodies: Matter.Body[];
  sensor: Matter.Body;
  update(
    engine: Matter.Engine,
    deltaMs: number,
    onDispense?: (ballId: number) => void
  ): void;
}

/**
 * 坂2の左端 (x=470, y=700) から落ちてきたボールを受け止め、
 * 最上部 (300, 130) まで持ち上げて坂1投入口へ放出するエレベーター。
 */
export function createElevator(options: ElevatorOptions = {}): ElevatorComponent {
  const x = options.x ?? 300;
  const bottomY = options.bottomY ?? 760;
  const topY = options.topY ?? 130;
  const speed = options.speed ?? 300;
  const color = options.color ?? "#16a085";

  let currentY = bottomY;
  let state: "waiting_bottom" | "moving_up" | "dispensing" | "moving_down" =
    "waiting_bottom";
  let stateTimer = 0;

  // キャリアーの底板（シュートから勢いよく飛び込むボールの着地ばらつきを吸収できる
  // 広さを確保する。狭いと自由落下の放物線が受け皿を飛び越えて床まで落ちてしまう）。
  // 薄い板 (旧 14px) だと、勢いよく落下するボールが 1 ステップの間に板を
  // すり抜けてしまうことがあったため、厚みを大きく確保して確実に受け止める
  const carrierBase = Matter.Bodies.rectangle(x, currentY + 24, 150, 40, {
    isStatic: true,
    label: "elevator_carrier",
    plugin: { color },
  });

  // 左壁（高めにしてこぼれ防止）
  const carrierLeftWall = Matter.Bodies.rectangle(x - 70, currentY - 8, 14, 60, {
    isStatic: true,
    label: "elevator_carrier",
    plugin: { color },
  });

  // 右壁（シュートから勢いよく落ちてくるボールを受け止められる高さを確保しつつ、
  // 上部での排出は setVelocity で強制するため妨げにならない）
  const carrierRightWall = Matter.Bodies.rectangle(x + 75, currentY - 6, 14, 70, {
    isStatic: true,
    label: "elevator_carrier",
    plugin: { color },
  });

  // 待機用の固定床。carrier が上昇中で不在の間、シュートから次々に到着する
  // ボールを受け止めて待たせる。これが無いと、複数ボールが短い間隔で到着する
  // 状況 (issue #4 で同時稼働数を増やした結果) で、carrier が上昇中に後続の
  // ボールが到着した際、受け止める床が無く地面まで落下し続けてしまい、
  // stall 検知に頼らないと回収できない詰まりになっていた (実測で確認)。
  // carrierBase 下面 (waiting_bottom 時 bottomY+44) との間に 20px 以上の隙間を
  // 空ける (隙間が数 px 程度しか無いと、ボールがその隙間で挟まって完全に
  // 動けなくなる状態を実測で確認した)。地面 (ground 上面) にも接触しない
  // 高さに収める。
  const waitingFloor = Matter.Bodies.rectangle(x, bottomY + 72, 150, 16, {
    isStatic: true,
    label: "elevator_carrier",
    plugin: { color },
  });

  // ガイドレール
  const rail = Matter.Bodies.rectangle(
    x - 85,
    (bottomY + topY) / 2,
    10,
    bottomY - topY + 90,
    {
      isStatic: true,
      label: "elevator_rail",
      plugin: { color: "#34495e" },
    }
  );

  // 通過検知用センサー（最上部付近）
  const sensor = Matter.Bodies.rectangle(x + 30, topY, 60, 40, {
    isStatic: true,
    isSensor: true,
    label: "elevator_sensor",
    plugin: { color: "transparent" },
  });

  const bodies = [
    rail,
    carrierBase,
    carrierLeftWall,
    carrierRightWall,
    waitingFloor,
    sensor,
  ];

  const updatePositions = (newY: number): void => {
    currentY = newY;
    Matter.Body.setPosition(carrierBase, { x, y: currentY + 24 });
    Matter.Body.setPosition(carrierLeftWall, { x: x - 70, y: currentY - 8 });
    Matter.Body.setPosition(carrierRightWall, { x: x + 75, y: currentY - 6 });
  };

  const dispensedBalls = new Set<number>();

  return {
    bodies,
    sensor,
    update(
      engine: Matter.Engine,
      deltaMs: number,
      onDispense?: (ballId: number) => void
    ): void {
      const deltaSec = deltaMs / 1000;
      const allBodies = Matter.Composite.allBodies(engine.world);
      const balls = allBodies.filter((b) => b.label === "ball");

      // waiting_bottom (carrier が底で待機中) の間だけ、判定範囲を待機用固定床
      // (bottomY+60 付近) まで広げる。moving_up 以降にこの範囲を広げたままだと、
      // carrier が不在の間に待機床へ新しく到着したボールまで「carrier 内」と
      // 誤認識し、carrierBase との物理的な接触なしに持ち上げ速度を与えてしまう。
      const carrierRangeBottom =
        state === "waiting_bottom" ? currentY + 90 : currentY + 44;
      const ballsInCarrier = balls.filter((b) => {
        return (
          Math.abs(b.position.x - x) < 80 &&
          b.position.y >= currentY - 45 &&
          b.position.y <= carrierRangeBottom
        );
      });

      switch (state) {
        case "waiting_bottom": {
          updatePositions(bottomY);

          // 待機床の上に降り積もったボールを carrierBase 上へ引き上げる。
          // carrierBase との間に意図的に空けた隙間 (直接の物理的接触が無い)
          // を自力で転がり越えることは期待できないため、ここで直接引き上げる
          // (launcher / branchGate と同じ「検知して直接書き換える」手法)。
          for (const ball of ballsInCarrier) {
            if (ball.position.y > currentY + 44) {
              Matter.Body.setPosition(ball, { x: ball.position.x, y: currentY + 10 });
              Matter.Body.setVelocity(ball, { x: 0, y: 0 });
            }
          }

          if (ballsInCarrier.length > 0) {
            state = "moving_up";
          }
          break;
        }
        case "moving_up": {
          const nextY = Math.max(topY, currentY - speed * deltaSec);
          updatePositions(nextY);

          for (const ball of ballsInCarrier) {
            Matter.Body.setVelocity(ball, { x: 0, y: -speed / 60 });
          }

          if (currentY <= topY) {
            state = "dispensing";
            stateTimer = 0;
          }
          break;
        }
        case "dispensing": {
          stateTimer += deltaMs;
          updatePositions(topY);

          for (const ball of ballsInCarrier) {
            Matter.Body.setVelocity(ball, { x: 8, y: -2 });

            const ballId = (ball.plugin as { ballData?: { id: number } })?.ballData?.id;
            if (ballId && !dispensedBalls.has(ballId)) {
              dispensedBalls.add(ballId);
              onDispense?.(ballId);
            }
          }

          if (stateTimer > 450 || ballsInCarrier.length === 0) {
            state = "moving_down";
          }
          break;
        }
        case "moving_down": {
          const nextY = Math.min(bottomY, currentY + speed * deltaSec);
          updatePositions(nextY);

          if (currentY >= bottomY) {
            state = "waiting_bottom";
            dispensedBalls.clear();
          }
          break;
        }
      }
    },
  };
}
