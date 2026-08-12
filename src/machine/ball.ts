import Matter from "matter-js";
import { generateBallVariation } from "../lib/ball-variation";
import type { Rng } from "../lib/random";

export interface BallUserData {
  id: number;
  color: string;
  radius: number;
}

let nextBallId = 1;

/**
 * ボール ID カウンターのリセット（テスト用）
 */
export function resetBallIdCounter(): void {
  nextBallId = 1;
}

const BALL_COLORS = [
  "#e74c3c", // 赤
  "#3498db", // 青
  "#2ecc71", // 緑
  "#f1c40f", // 黄
  "#9b59b6", // 紫
  "#e67e22", // オレンジ
];

/**
 * ボールを生成する。
 * 個体差 (半径・反発・密度・色) は src/lib/ball-variation.ts の純粋関数で
 * シード付き乱数から決める。stall 検知用に一意な id を付与する。
 */
export function createBall(rng: Rng, x: number, y: number): Matter.Body {
  const id = nextBallId;
  nextBallId += 1;

  const variation = generateBallVariation(rng, BALL_COLORS);

  const ballData: BallUserData = {
    id,
    color: variation.color,
    radius: variation.radius,
  };

  const ball = Matter.Bodies.circle(x, y, variation.radius, {
    restitution: variation.restitution,
    friction: 0.05,
    density: variation.density,
    label: "ball",
    plugin: {
      ballData,
    },
  });

  return ball;
}

/**
 * Matter.Body から BallUserData を取得する。
 */
export function getBallData(body: Matter.Body): BallUserData | undefined {
  return (body.plugin as { ballData?: BallUserData })?.ballData;
}
