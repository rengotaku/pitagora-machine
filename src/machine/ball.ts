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

// issue #5 で確定したデザイントークン。原色を避けた少しくすんだ玩具色。
const BALL_COLORS = [
  "#e8552f", // くすんだ朱色
  "#f2b134", // くすんだ黄色
  "#2e8bc0", // くすんだ青
  "#6bbf59", // くすんだ緑
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

  // 色だけは乱数に任せず順に使う。同時に流れるのは 5 個程度しかないため、
  // 乱数だと画面上が 2 色に偏って「カラフル」に見えないことが実測で分かった
  // （シードが固定なので偏り方も毎回同じになる）。サイズ・反発・密度の
  // ばらつきは従来どおり乱数から決める。
  const color = BALL_COLORS[id % BALL_COLORS.length];

  const ballData: BallUserData = {
    id,
    color,
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
