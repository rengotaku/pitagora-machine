import Matter from "matter-js";
import type { Rng } from "../lib/random";
import { pick } from "../lib/random";

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

const BALL_SIZES = [14, 18, 22];
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
 * src/lib/random.ts でサイズ（2〜3種類）と色にばらつきを持たせる。
 * stall 検知用に一意な id を付与する。
 */
export function createBall(rng: Rng, x: number, y: number): Matter.Body {
  const id = nextBallId;
  nextBallId += 1;

  const radius = pick(rng, BALL_SIZES);
  const color = pick(rng, BALL_COLORS);

  const ballData: BallUserData = {
    id,
    color,
    radius,
  };

  const ball = Matter.Bodies.circle(x, y, radius, {
    restitution: 0.5,
    friction: 0.05,
    density: 0.002,
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
