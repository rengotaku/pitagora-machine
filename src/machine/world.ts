import Matter from "matter-js";
import { BIRCH_SHADOW_COLOR, WORLD_HEIGHT, WORLD_WIDTH } from "../config";

export interface PitagoraWorld {
  engine: Matter.Engine;
}

/**
 * Matter.js の Engine をセットアップし、
 * 論理ワールド 1600x900 の外周（左右の壁・最下部の床）を構築する。
 */
export function createPitagoraWorld(): PitagoraWorld {
  // constraintIterations を既定 (4) より増やし、シーソーの支点・カウンターウェイトのような
  // 硬い constraint 同士が連なる箇所での数値的な不安定 (意図しない急激な回転) を抑える。
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 1, scale: 0.001 },
    constraintIterations: 10,
  });

  const wallThickness = 60;

  // 最下部の床（装置全体を支える台座。木部として扱う）
  const ground = Matter.Bodies.rectangle(
    WORLD_WIDTH / 2,
    WORLD_HEIGHT - wallThickness / 2,
    WORLD_WIDTH,
    wallThickness,
    {
      isStatic: true,
      label: "ground",
      plugin: { color: BIRCH_SHADOW_COLOR, material: "wood", moving: false },
    }
  );

  // 左の壁
  const leftWall = Matter.Bodies.rectangle(
    wallThickness / 2,
    WORLD_HEIGHT / 2,
    wallThickness,
    WORLD_HEIGHT,
    {
      isStatic: true,
      label: "wall",
      plugin: { color: BIRCH_SHADOW_COLOR, material: "wood", moving: false },
    }
  );

  // 右の壁
  const rightWall = Matter.Bodies.rectangle(
    WORLD_WIDTH - wallThickness / 2,
    WORLD_HEIGHT / 2,
    wallThickness,
    WORLD_HEIGHT,
    {
      isStatic: true,
      label: "wall",
      plugin: { color: BIRCH_SHADOW_COLOR, material: "wood", moving: false },
    }
  );

  Matter.Composite.add(engine.world, [ground, leftWall, rightWall]);

  return { engine };
}
