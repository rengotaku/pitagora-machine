import Matter from "matter-js";
import { STEEL_COLOR } from "../../config";
import { setBodyAngle, setBodyPosition } from "../kinematic";

export interface PendulumOptions {
  pivotX: number;
  pivotY: number;
  armLength?: number;
  bobRadius?: number;
  periodMs?: number;
  amplitudeRad?: number;
  sensorY: number;
  sensorWidth?: number;
  sensorHeight?: number;
  color?: string;
  label?: string;
}

export interface PendulumComponent {
  bodies: Matter.Body[];
  sensor: Matter.Body;
  update(engine: Matter.Engine, deltaMs: number, onHit?: (ballId: number) => void): void;
  /** 振動の位相を 0 (振り子が真下で静止する角度) へ戻し、腕・おもりの位置も即座に反映する。 */
  reset(): void;
}

/**
 * 一定の周期で揺れる振り子。角度をキネマティックに (setPosition/setAngle) 駆動するため、
 * ボールとの衝突でエネルギーを失っても周期・振幅は変化せず、一定周期で揺れ続ける。
 * カウント用センサーはボールが実際に転がる坂の表面付近に広く配置し、
 * 振り子の腕が正確に当たったかどうかに関わらず「通過した」ことを確実に検知する。
 */
export function createPendulum(options: PendulumOptions): PendulumComponent {
  const armLength = options.armLength ?? 105;
  const bobRadius = options.bobRadius ?? 15;
  const periodMs = options.periodMs ?? 2100;
  const amplitudeRad = options.amplitudeRad ?? 0.75;
  const color = options.color ?? STEEL_COLOR;
  const label = options.label ?? "pendulum";
  const pivotX = options.pivotX;
  const pivotY = options.pivotY;

  const pivot = Matter.Bodies.circle(pivotX, pivotY, 5, {
    isStatic: true,
    label: "pendulum_pivot",
    plugin: { color: STEEL_COLOR, material: "metal", moving: false },
  });

  const rod = Matter.Bodies.rectangle(pivotX, pivotY + armLength / 2, 4, armLength, {
    isStatic: true,
    label: "pendulum_rod",
    plugin: { color: STEEL_COLOR, material: "metal", moving: true },
  });

  // isStatic な Body は Matter.js 内部で restitution が強制的に 0 に上書きされる
  // (Body.setStatic の仕様) ため restitution オプションは指定しない。叩く力は
  // キネマティックに与える位置 (update 内の setPosition) がそのまま衝突点の
  // 相対速度として使われることで生まれる。
  const bob = Matter.Bodies.circle(pivotX, pivotY + armLength, bobRadius, {
    isStatic: true,
    label,
    plugin: { color, material: "metal", moving: true },
  });

  const sensorWidth =
    options.sensorWidth ?? armLength * Math.sin(amplitudeRad) * 2 + bobRadius * 4;
  const sensorHeight = options.sensorHeight ?? 90;
  const sensor = Matter.Bodies.rectangle(
    pivotX,
    options.sensorY,
    sensorWidth,
    sensorHeight,
    {
      isStatic: true,
      isSensor: true,
      label: `${label}_sensor`,
      plugin: { color: "transparent" },
    }
  );

  const hitBalls = new Set<number>();
  let elapsedMs = 0;

  /** 指定した角度に腕・おもりの位置を反映する (update()/reset() で共有)。 */
  const applyAngle = (angle: number): void => {
    const bobX = pivotX + armLength * Math.sin(angle);
    const bobY = pivotY + armLength * Math.cos(angle);
    setBodyPosition(bob, { x: bobX, y: bobY }, true);

    const rodX = pivotX + (armLength / 2) * Math.sin(angle);
    const rodY = pivotY + (armLength / 2) * Math.cos(angle);
    setBodyPosition(rod, { x: rodX, y: rodY }, true);
    setBodyAngle(rod, angle, true);
  };

  return {
    bodies: [pivot, rod, bob, sensor],
    sensor,
    update(
      engine: Matter.Engine,
      deltaMs: number,
      onHit?: (ballId: number) => void
    ): void {
      elapsedMs += deltaMs;
      const phase = (2 * Math.PI * elapsedMs) / periodMs;
      const angle = amplitudeRad * Math.sin(phase);
      applyAngle(angle);

      const balls = Matter.Composite.allBodies(engine.world).filter(
        (b) => b.label === "ball"
      );
      for (const ball of balls) {
        const ballId = (ball.plugin as { ballData?: { id: number } })?.ballData?.id;
        if (!ballId) continue;

        const inSensor = Matter.Bounds.overlaps(sensor.bounds, ball.bounds);
        if (inSensor && !hitBalls.has(ballId)) {
          hitBalls.add(ballId);
          onHit?.(ballId);
        } else if (!inSensor && hitBalls.has(ballId)) {
          hitBalls.delete(ballId);
        }
      }
    },
    reset(): void {
      elapsedMs = 0;
      hitBalls.clear();
      applyAngle(0);
    },
  };
}
