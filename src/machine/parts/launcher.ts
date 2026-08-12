import Matter from "matter-js";

export interface LauncherOptions {
  x?: number;
  y?: number;
  launchVx?: number;
  launchVy?: number;
  color?: string;
}

export interface LauncherComponent {
  bodies: Matter.Body[];
  sensor: Matter.Body;
  update(engine: Matter.Engine, onLaunch?: (ballId: number) => void): void;
}

/**
 * シーソーから受け取ったボールを右上方向へ打ち出す発射装置。
 */
export function createLauncher(options: LauncherOptions = {}): LauncherComponent {
  const x = options.x ?? 1150;
  const y = options.y ?? 470;
  const launchVx = options.launchVx ?? 14.0;
  const launchVy = options.launchVy ?? -16.5;
  const color = options.color ?? "#9b59b6";

  // 発射台の底面（傾斜をつけてボールを中央へ導く）
  const base = Matter.Bodies.rectangle(x, y + 20, 100, 16, {
    isStatic: true,
    angle: 0.1,
    label: "launcher_base",
    plugin: { color },
  });

  // 右側のストッパー壁（sensor 範囲から完全に離し、打ち出し直後のボールの
  // 右上への軌道と接触しない位置に置く。base の傾斜だけで中央へ導けるため、
  // sensor の右端に近いと発射直後のボールと衝突し、上昇中に跳ね返されて
  // 再度 sensor に落ちて再発射される無限ループの原因になっていた）
  const backWall = Matter.Bodies.rectangle(x + 75, y + 18, 14, 25, {
    isStatic: true,
    label: "launcher_wall",
    plugin: { color },
  });

  // センサー領域。base 上面 (y-5 付近の base 中心 y+20, 厚み16の上面 ≈ y+12) と
  // 重なる範囲を含めると、発射位置固定 (setPosition) の際にボールが base に
  // めり込み、めり込み解消でランダムな方向へ弾かれて着地点が大きく乱れる原因に
  // なるため、base 上面より確実に上の薄い範囲に限定する。
  // 幅は、シーソー側シュートからの自由落下でボールが sensor 範囲を飛び越えて
  // 手前の ramp2 に直接着地してしまわないよう、広めに確保する。
  const sensorCenterY = y - 20;
  const sensor = Matter.Bodies.rectangle(x, sensorCenterY, 220, 40, {
    isStatic: true,
    isSensor: true,
    label: "launcher_sensor",
    plugin: { color: "transparent" },
  });

  const launchedBalls = new Set<number>();

  return {
    bodies: [base, backWall, sensor],
    sensor,
    update(engine: Matter.Engine, onLaunch?: (ballId: number) => void): void {
      const bodies = Matter.Composite.allBodies(engine.world);
      const balls = bodies.filter((b) => b.label === "ball");

      for (const ball of balls) {
        const ballId = (ball.plugin as { ballData?: { id: number } })?.ballData?.id;

        const inSensor = Matter.Bounds.overlaps(sensor.bounds, ball.bounds);

        if (inSensor) {
          if (ballId && !launchedBalls.has(ballId)) {
            launchedBalls.add(ballId);
            // sensor 内のどこでボールが検知されたかによって発射位置がばらつくと、
            // 着地点が大きく揺れて ramp2 を外れたり catcherBackWall に接触したり
            // する原因になるため、発射位置を sensor 中心に固定してから
            // 一定の軌道で右上へ力強く射出する
            Matter.Body.setPosition(ball, { x, y: sensorCenterY });
            Matter.Body.setVelocity(ball, { x: launchVx, y: launchVy });
            onLaunch?.(ballId);
          }
        } else if (ballId && launchedBalls.has(ballId)) {
          const distSq = (ball.position.x - x) ** 2 + (ball.position.y - y) ** 2;
          if (distSq > 150 ** 2) {
            launchedBalls.delete(ballId);
          }
        }
      }
    },
  };
}
