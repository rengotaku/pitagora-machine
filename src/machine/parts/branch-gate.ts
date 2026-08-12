import Matter from "matter-js";
import { STEEL_COLOR } from "../../config";
import type { Rng } from "../../lib/random";
import { createRouteSelector, type RouteSide } from "../../lib/route-choice";
import { setBodyAngle } from "../kinematic";

export interface BranchGateOptions {
  x: number;
  y: number;
  width?: number;
  height?: number;
  leftWeight?: number;
  rightWeight?: number;
  maxStreak?: number;
  flapY?: number;
  label?: string;
}

export interface BranchGateComponent {
  bodies: Matter.Body[];
  sensor: Matter.Body;
  flap: Matter.Body;
  update(
    engine: Matter.Engine,
    rng: Rng,
    onChoice?: (side: RouteSide, ballId: number) => void
  ): void;
  /**
   * フラップの角度を生成時の中立位置 (0) へ戻し、判定済みボールの記録・
   * 偏り補正の連続選択カウント (route-choice.ts の selector) も破棄する。
   */
  reset(): void;
}

/**
 * 通過するボールを左右どちらかへ振り分ける分岐ゲート。
 *
 * 実際の誘導は launcher と同じ手法で、センサーに入ったボールの速度を
 * 直接書き換えることで行う (2D の坂の上を安全に転がり続けるボールに対して、
 * 新たな物理的な分岐トラックを設けるより低リスク)。フラップの見た目は
 * 直近の判定結果を示すインジケータとして角度を切り替える (ボールの経路には
 * 干渉しない位置に配置する)。
 */
export function createBranchGate(options: BranchGateOptions): BranchGateComponent {
  const width = options.width ?? 120;
  const height = options.height ?? 100;
  const leftWeight = options.leftWeight ?? 1;
  const rightWeight = options.rightWeight ?? 1;
  const maxStreak = options.maxStreak ?? 4;
  const label = options.label ?? "branch";

  const sensor = Matter.Bodies.rectangle(options.x, options.y, width, height, {
    isStatic: true,
    isSensor: true,
    label: `${label}_sensor`,
    plugin: { color: "transparent" },
  });

  const flapY = options.flapY ?? options.y - height / 2 - 25;
  const flap = Matter.Bodies.rectangle(options.x, flapY, 46, 8, {
    isStatic: true,
    label: `${label}_flap`,
    plugin: { color: STEEL_COLOR, material: "metal", moving: false },
  });

  const selector = createRouteSelector({ leftWeight, rightWeight, maxStreak });
  const decidedBalls = new Set<number>();
  // ゲートを通過し終えた (=再判定してよい) とみなす x 座標。センサー境界そのもの
  // (縦方向の出入り) で再アームすると、"left" 判定の上向きキックでボールが
  // センサーの上端付近を小刻みに出入りし、同じ通過中に何度も速度を上書きして
  // 不安定化する (実測で確認済み)。ゲートを明確に通り過ぎた x 座標を使うことで、
  // 1 回の通過につき判定は必ず 1 回だけにする。
  const clearX = options.x + width;

  return {
    bodies: [sensor, flap],
    sensor,
    flap,
    update(
      engine: Matter.Engine,
      rng: Rng,
      onChoice?: (side: RouteSide, ballId: number) => void
    ): void {
      const balls = Matter.Composite.allBodies(engine.world).filter(
        (b) => b.label === "ball"
      );

      for (const ball of balls) {
        const ballId = (ball.plugin as { ballData?: { id: number } })?.ballData?.id;
        if (!ballId) continue;

        const inSensor = Matter.Bounds.overlaps(sensor.bounds, ball.bounds);
        if (inSensor && !decidedBalls.has(ballId)) {
          decidedBalls.add(ballId);
          const side = selector.choose(rng);
          const v = ball.velocity;

          // 前進速度のブーストは左右どちらでも与える (差は縦方向の挙動だけ)。
          // "left" 側だけ加速しない設計だと、その回のボールだけラップタイムが
          // 伸びて 60 秒の計測窓内に周回し切れないことがあった (実測で確認)。
          if (side === "right") {
            Matter.Body.setVelocity(ball, { x: v.x + 2.5, y: v.y });
            setBodyAngle(flap, 0.3, true);
          } else {
            Matter.Body.setVelocity(ball, { x: v.x + 1.5, y: v.y - 1.5 });
            setBodyAngle(flap, -0.3, true);
          }

          onChoice?.(side, ballId);
        } else if (!inSensor && decidedBalls.has(ballId) && ball.position.x > clearX) {
          decidedBalls.delete(ballId);
        }
      }
    },
    reset(): void {
      setBodyAngle(flap, 0, true);
      decidedBalls.clear();
      selector.reset();
    },
  };
}
