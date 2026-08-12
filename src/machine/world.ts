import Matter from "matter-js";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../config";

export interface PitagoraWorld {
  engine: Matter.Engine;
}

/**
 * Matter.js の Engine をセットアップし、
 * 論理ワールド 1600x900 の外周（左右の壁・最下部の床）を構築する。
 */
export function createPitagoraWorld(): PitagoraWorld {
  const engine = Matter.Engine.create({
    gravity: { x: 0, y: 1, scale: 0.001 },
  });

  const wallThickness = 60;

  // 最下部の床
  const ground = Matter.Bodies.rectangle(
    WORLD_WIDTH / 2,
    WORLD_HEIGHT - wallThickness / 2,
    WORLD_WIDTH,
    wallThickness,
    {
      isStatic: true,
      label: "ground",
      plugin: { color: "#5c4d42" },
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
      plugin: { color: "#5c4d42" },
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
      plugin: { color: "#5c4d42" },
    }
  );

  Matter.Composite.add(engine.world, [ground, leftWall, rightWall]);

  return { engine };
}
