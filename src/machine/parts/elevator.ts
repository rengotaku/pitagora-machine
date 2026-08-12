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

  const bodies = [rail, carrierBase, carrierLeftWall, carrierRightWall, sensor];

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

      const ballsInCarrier = balls.filter((b) => {
        return (
          Math.abs(b.position.x - x) < 80 &&
          b.position.y >= currentY - 45 &&
          b.position.y <= currentY + 44
        );
      });

      switch (state) {
        case "waiting_bottom": {
          updatePositions(bottomY);
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
