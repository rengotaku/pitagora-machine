import Matter from "matter-js";
import { BIRCH_COLOR, STEEL_COLOR } from "../../config";

export interface SeesawOptions {
  x?: number;
  y?: number;
  length?: number;
  thickness?: number;
}

export interface SeesawComponent {
  bodies: Matter.Body[];
  constraints: Matter.Constraint[];
  board: Matter.Body;
  sensor: Matter.Body;
  /** 板・カウンターウェイトの位置・角度・速度を生成時の静止姿勢へ戻す。 */
  reset(): void;
}

/**
 * 支点で回転するシーソーパーツを生成する。
 * 静止時は左端が下がった姿勢（左下がり）を維持し、ボール通過後はカウンターウェイトで速やかに復元する。
 * ストッパーにより極端な角度（垂直など）への回転を防ぐ。
 */
export function createSeesaw(options: SeesawOptions = {}): SeesawComponent {
  const x = options.x ?? 900;
  const y = options.y ?? 360;
  const length = options.length ?? 260;
  const thickness = options.thickness ?? 16;

  const initialAngle = -0.08;

  // シーソーの板（木部・動くパーツ）
  const board = Matter.Bodies.rectangle(x, y, length, thickness, {
    density: 0.004,
    friction: 0.03,
    restitution: 0.1,
    angle: initialAngle,
    label: "seesaw_board",
    plugin: { color: BIRCH_COLOR, material: "wood", moving: true },
  });

  // 支点 Constraint
  const pivot = Matter.Constraint.create({
    pointA: { x, y },
    bodyB: board,
    pointB: { x: 0, y: 0 },
    stiffness: 1,
    length: 0,
  });

  // 左側のカウンターウェイト（左下がりの静止姿勢を維持し自重で復元）
  // board に完全剛体固定 (length: 0) すると、重り込みの系全体の重心が支点から見て
  // 右下がり方向へ回転した方が低くなる不安定な配置になり、右に傾いたまま戻らなくなる。
  // pointA から少し離した振り子として自由回転させることで、常に重力で「取り付け点の
  // 真下」を向こうとする復元力になり、左下がり方向へ安定して戻るようにする。
  const weightRadius = 16;
  const pendulumLength = 32;
  const attachPointX = -length / 2 + 25;
  const attachWorldX = x + attachPointX * Math.cos(initialAngle);
  const attachWorldY = y + attachPointX * Math.sin(initialAngle);
  const counterWeight = Matter.Bodies.circle(
    attachWorldX,
    attachWorldY + pendulumLength,
    weightRadius,
    {
      density: 0.004,
      label: "seesaw_weight",
      plugin: { color: STEEL_COLOR, material: "metal", moving: true },
    }
  );

  const weightConstraint = Matter.Constraint.create({
    bodyA: board,
    pointA: { x: attachPointX, y: 0 },
    bodyB: counterWeight,
    pointB: { x: 0, y: 0 },
    stiffness: 0.2,
    damping: 0.4,
    length: pendulumLength,
  });

  // 角度制限ストッパー（垂直立ちを防止し、-0.2〜+0.22rad の可動域に固定）
  const stopperLeft = Matter.Bodies.circle(x - length / 2 + 10, y + 36, 12, {
    isStatic: true,
    label: "seesaw_stopper",
    plugin: { color: STEEL_COLOR, material: "metal", moving: false },
  });

  const stopperRight = Matter.Bodies.circle(x + length / 2 - 10, y + 42, 12, {
    isStatic: true,
    label: "seesaw_stopper",
    plugin: { color: STEEL_COLOR, material: "metal", moving: false },
  });

  // 通過検知用センサー
  const sensor = Matter.Bodies.rectangle(x, y - 15, length * 0.7, 40, {
    isStatic: true,
    isSensor: true,
    label: "seesaw_sensor",
    plugin: { color: "transparent" },
  });

  return {
    bodies: [board, counterWeight, stopperLeft, stopperRight, sensor],
    constraints: [pivot, weightConstraint],
    board,
    sensor,
    reset(): void {
      Matter.Body.setPosition(board, { x, y });
      Matter.Body.setAngle(board, initialAngle);
      Matter.Body.setVelocity(board, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(board, 0);

      Matter.Body.setPosition(counterWeight, {
        x: attachWorldX,
        y: attachWorldY + pendulumLength,
      });
      Matter.Body.setAngle(counterWeight, 0);
      Matter.Body.setVelocity(counterWeight, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(counterWeight, 0);
    },
  };
}
