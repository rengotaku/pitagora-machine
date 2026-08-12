import Matter from "matter-js";
import { STEEL_COLOR } from "../../config";

export interface BounceFloorOptions {
  x: number;
  y: number;
  angle: number;
  length?: number;
  thickness?: number;
  bounceSpeed?: number;
  friction?: number;
  sensorHeight?: number;
  color?: string;
  label?: string;
}

export interface BounceFloorComponent {
  bodies: Matter.Body[];
  sensor: Matter.Body;
  update(engine: Matter.Engine, onBounce?: (ballId: number) => void): void;
  /** 通過検知の記録を破棄する (床本体は静的で位置・角度は変化しないため対象外)。 */
  reset(): void;
}

/**
 * バウンドする床。
 *
 * Matter.js は isStatic な Body 生成時に restitution を強制的に 0 へ上書きする
 * (Body.setStatic の仕様。ball 側の restitution=0.5 との合成 (max) で衝突自体は
 * 起きるが、床側だけを高反発にすることはできない)。そのため受動的な反発係数には
 * 頼らず、launcher と同じ手法でセンサー通過時にボールの速度へ直接、開放側
 * (法線) 方向への跳ね上げを加える。床の本体は視覚的な目印と衝突のきっかけを
 * 兼ねる。
 */
export function createBounceFloor(options: BounceFloorOptions): BounceFloorComponent {
  const length = options.length ?? 90;
  const thickness = options.thickness ?? 10;
  const bounceSpeed = options.bounceSpeed ?? 6.5;
  const friction = options.friction ?? 0.01;
  const color = options.color ?? STEEL_COLOR;
  const label = options.label ?? "bounce_floor";

  const floor = Matter.Bodies.rectangle(options.x, options.y, length, thickness, {
    isStatic: true,
    angle: options.angle,
    friction,
    label,
    plugin: { color, material: "metal", moving: false },
  });

  // normal: ボールが転がる開放側 (角度 0 で真上になる) 方向 (sinθ, -cosθ)
  const normal = { x: Math.sin(options.angle), y: -Math.cos(options.angle) };
  const sensorHeight = options.sensorHeight ?? 70;
  const sensorOffset = thickness / 2 + sensorHeight / 2;
  const sensor = Matter.Bodies.rectangle(
    options.x + normal.x * sensorOffset,
    options.y + normal.y * sensorOffset,
    length * 0.9,
    sensorHeight,
    {
      isStatic: true,
      isSensor: true,
      angle: options.angle,
      label: `${label}_sensor`,
      plugin: { color: "transparent" },
    }
  );

  const bouncedBalls = new Set<number>();

  return {
    bodies: [floor, sensor],
    sensor,
    update(engine: Matter.Engine, onBounce?: (ballId: number) => void): void {
      const balls = Matter.Composite.allBodies(engine.world).filter(
        (b) => b.label === "ball"
      );

      for (const ball of balls) {
        const ballId = (ball.plugin as { ballData?: { id: number } })?.ballData?.id;
        if (!ballId) continue;

        const inSensor = Matter.Bounds.overlaps(sensor.bounds, ball.bounds);
        if (inSensor) {
          if (!bouncedBalls.has(ballId)) {
            bouncedBalls.add(ballId);
            const v = ball.velocity;
            Matter.Body.setVelocity(ball, {
              x: v.x + normal.x * bounceSpeed,
              y: v.y + normal.y * bounceSpeed,
            });
            onBounce?.(ballId);
          }
        } else if (bouncedBalls.has(ballId)) {
          bouncedBalls.delete(ballId);
        }
      }
    },
    reset(): void {
      bouncedBalls.clear();
    },
  };
}
