import Matter from "matter-js";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../config";
import { createRng } from "../lib/random";
import { nextSpawnDelay, shouldSpawnBall } from "../lib/spawn-policy";
import { createTimestepCalculator } from "../lib/timestep";
import { fitWorldToCanvas, type ViewportTransform } from "../lib/viewport";
import { renderWorld } from "../render/renderer";
import { createBall } from "./ball";
import { createRamp } from "./parts/ramp";
import { createPitagoraWorld } from "./world";

export interface SimulationConfig {
  maxActiveBalls?: number;
  seed?: number;
  fixedDeltaMs?: number;
  maxStepsPerFrame?: number;
  minSpawnDelayMs?: number;
  maxSpawnDelayMs?: number;
}

export interface SimulationInstance {
  stop(): void;
}

/**
 * ピタゴラ装置のシミュレーションとメインループを起動する。
 */
export function startSimulation(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  config: SimulationConfig = {}
): SimulationInstance {
  const maxActiveBalls = config.maxActiveBalls ?? 6;
  const seed = config.seed ?? 12345;
  const fixedDeltaMs = config.fixedDeltaMs ?? 16.666;
  const maxStepsPerFrame = config.maxStepsPerFrame ?? 5;
  const minSpawnDelayMs = config.minSpawnDelayMs ?? 1500;
  const maxSpawnDelayMs = config.maxSpawnDelayMs ?? 4000;

  const rng = createRng(seed);
  const { engine } = createPitagoraWorld();
  const timestepCalc = createTimestepCalculator({
    fixedDeltaMs,
    maxStepsPerFrame,
  });

  // 坂パーツの配置（投入口から床まで転がるジグザグコース）
  const ramp1 = createRamp({
    x: 450,
    y: 220,
    length: 750,
    angle: 0.18,
  });
  const ramp2 = createRamp({
    x: 1150,
    y: 440,
    length: 750,
    angle: -0.18,
  });
  const ramp3 = createRamp({
    x: 450,
    y: 660,
    length: 750,
    angle: 0.18,
  });

  Matter.Composite.add(engine.world, [ramp1, ramp2, ramp3]);

  let transform: ViewportTransform = fitWorldToCanvas(WORLD_WIDTH, WORLD_HEIGHT, 1, 1);
  let cssWidth = window.innerWidth || 1600;
  let cssHeight = window.innerHeight || 900;

  const resize = (): void => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    cssWidth = Math.max(window.innerWidth || 1600, 1);
    cssHeight = Math.max(window.innerHeight || 900, 1);

    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    transform = fitWorldToCanvas(WORLD_WIDTH, WORLD_HEIGHT, cssWidth, cssHeight);
  };

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("resize", resize);
    resize();
  }

  // シミュレーション状態
  let lastTime = typeof performance !== "undefined" ? performance.now() : 0;
  let elapsedMs = 0;
  let msSinceLastSpawn = 0;
  let nextDelayMs = nextSpawnDelay(rng, minSpawnDelayMs, maxSpawnDelayMs);
  let minActiveBalls = Infinity;
  let hasSpawned = false;

  // FPS 計算用
  let frameCount = 0;
  let fpsTimer = 0;
  let currentFps = 60;

  let animId = 0;
  let running = true;

  const spawnBall = (): void => {
    // 投入口 (x=160, y=80) 付近
    const ballX = 160 + (rng() * 20 - 10);
    const ballY = 80;
    const ball = createBall(rng, ballX, ballY);
    Matter.Composite.add(engine.world, ball);
    hasSpawned = true;
  };

  // 初回判定と初期状態セット
  const updateStats = (): void => {
    const allBodies = Matter.Composite.allBodies(engine.world);
    const balls = allBodies.filter((b) => b.label === "ball");
    const activeBalls = balls.length;

    if (hasSpawned && activeBalls < minActiveBalls) {
      minActiveBalls = activeBalls;
    }

    const currentMin = minActiveBalls === Infinity ? activeBalls : minActiveBalls;

    if (typeof window !== "undefined") {
      window.__pitagora = {
        activeBalls,
        minActiveBalls: currentMin,
        fps: currentFps,
        elapsedMs,
      };
    }
  };

  updateStats();

  const loop = (now: number): void => {
    if (!running) return;

    const frameDelta = Math.max(0, now - lastTime);
    lastTime = now;

    elapsedMs += frameDelta;
    msSinceLastSpawn += frameDelta;

    // FPS 計算
    frameCount += 1;
    fpsTimer += frameDelta;
    if (fpsTimer >= 500) {
      currentFps = Math.round((frameCount * 1000) / fpsTimer);
      frameCount = 0;
      fpsTimer = 0;
    }

    // 固定タイムステップで物理計算を進める
    const { steps } = timestepCalc.update(frameDelta);
    for (let i = 0; i < steps; i += 1) {
      Matter.Engine.update(engine, fixedDeltaMs);
    }

    // ボール数のカウント
    const allBodies = Matter.Composite.allBodies(engine.world);
    const balls = allBodies.filter((b) => b.label === "ball");
    const activeBalls = balls.length;

    // ボール投入判定
    if (
      shouldSpawnBall({
        activeBalls,
        msSinceLastSpawn,
        nextDelayMs,
        maxActiveBalls,
      })
    ) {
      spawnBall();
      msSinceLastSpawn = 0;
      nextDelayMs = nextSpawnDelay(rng, minSpawnDelayMs, maxSpawnDelayMs);
    }

    updateStats();

    // Canvas 2D 描画
    renderWorld(ctx, engine, transform, cssWidth, cssHeight);

    if (typeof requestAnimationFrame !== "undefined") {
      animId = requestAnimationFrame(loop);
    }
  };

  // 即時初回フレーム実行（テスト環境やアニメーション開始）
  spawnBall();
  msSinceLastSpawn = 0;
  nextDelayMs = nextSpawnDelay(rng, minSpawnDelayMs, maxSpawnDelayMs);
  updateStats();

  if (typeof requestAnimationFrame !== "undefined") {
    animId = requestAnimationFrame(loop);
  }

  return {
    stop(): void {
      running = false;
      if (typeof cancelAnimationFrame !== "undefined" && animId) {
        cancelAnimationFrame(animId);
      }
      if (typeof window !== "undefined" && window.removeEventListener) {
        window.removeEventListener("resize", resize);
      }
    },
  };
}
