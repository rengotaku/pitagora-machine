import Matter from "matter-js";
import { setBodyAngle } from "../kinematic";

export interface WheelOptions {
  x: number;
  y: number;
  radius?: number;
  bladeLength?: number;
  bladeThickness?: number;
  angularSpeed?: number;
  sensorY: number;
  sensorWidth?: number;
  sensorHeight?: number;
  color?: string;
  label?: string;
}

export interface WheelComponent {
  bodies: Matter.Body[];
  sensor: Matter.Body;
  update(engine: Matter.Engine, deltaMs: number, onPass?: (ballId: number) => void): void;
}

/**
 * モーターで定速回転するパドルホイール。
 * isStatic のまま角度を毎ステップ書き換える (キネマティック制御) ことで、
 * ボールとの衝突で減速せず一定速度で回り続け、羽根が触れたボールを弾き飛ばす。
 * カウント用センサーは羽根の可動域から独立させ、ボールが実際に転がる坂の
 * 表面付近に広く配置することで、羽根との物理的な接触精度に関わらず
 * 「通過した」ことを確実に検知する。
 */
export function createWheel(options: WheelOptions): WheelComponent {
  const radius = options.radius ?? 14;
  const bladeLength = options.bladeLength ?? 100;
  const bladeThickness = options.bladeThickness ?? 10;
  const angularSpeed = options.angularSpeed ?? 4.0;
  const color = options.color ?? "#c0392b";
  const label = options.label ?? "wheel";

  const hub = Matter.Bodies.circle(options.x, options.y, radius, {
    isStatic: true,
    label,
    plugin: { color },
  });

  // isStatic な Body は Matter.js 内部で restitution が強制的に 0 に上書きされる
  // (Body.setStatic の仕様) ため restitution オプションは指定しない。羽根の
  // 弾く力はキネマティックに与える角速度 (update 内の setAngle) がそのまま
  // 衝突点の相対速度として使われることで生まれる。
  const bladeA = Matter.Bodies.rectangle(
    options.x,
    options.y,
    bladeLength,
    bladeThickness,
    {
      isStatic: true,
      label,
      plugin: { color },
    }
  );

  const bladeB = Matter.Bodies.rectangle(
    options.x,
    options.y,
    bladeThickness,
    bladeLength,
    {
      isStatic: true,
      label,
      plugin: { color },
    }
  );

  const sensorWidth = options.sensorWidth ?? bladeLength * 1.8;
  const sensorHeight = options.sensorHeight ?? 90;
  const sensor = Matter.Bodies.rectangle(
    options.x,
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

  const passedBalls = new Set<number>();

  return {
    bodies: [hub, bladeA, bladeB, sensor],
    sensor,
    update(
      engine: Matter.Engine,
      deltaMs: number,
      onPass?: (ballId: number) => void
    ): void {
      const deltaSec = deltaMs / 1000;
      const nextAngle = hub.angle + angularSpeed * deltaSec;
      setBodyAngle(hub, nextAngle, true);
      setBodyAngle(bladeA, nextAngle, true);
      // bladeB は幅と高さを入れ替えて生成しているため、角度 0 の時点で bladeA と
      // 直交している。ここで π/2 を足すと 2 枚が同じ向きに重なり、十字ではなく
      // 1 本の羽根になってボールを弾く範囲が半分になる。
      setBodyAngle(bladeB, nextAngle, true);

      const balls = Matter.Composite.allBodies(engine.world).filter(
        (b) => b.label === "ball"
      );
      for (const ball of balls) {
        const ballId = (ball.plugin as { ballData?: { id: number } })?.ballData?.id;
        if (!ballId) continue;

        const inSensor = Matter.Bounds.overlaps(sensor.bounds, ball.bounds);
        if (inSensor && !passedBalls.has(ballId)) {
          passedBalls.add(ballId);
          onPass?.(ballId);
        } else if (!inSensor && passedBalls.has(ballId)) {
          passedBalls.delete(ballId);
        }
      }
    },
  };
}
