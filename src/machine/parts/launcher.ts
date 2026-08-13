import Matter from "matter-js";
import { BIRCH_SHADOW_COLOR } from "../../config";

export interface LauncherOptions {
  x?: number;
  y?: number;
  launchVx?: number;
  launchVy?: number;
  color?: string;
  /**
   * 着地加速を有効にする坂の勾配角度 (ラジアン)。省略時は着地加速を行わない。
   * 下り方向は (-cos(angle), -sin(angle)) として計算する。
   */
  landingAngle?: number;
  /** 着地加速の対象にする速度のしきい値 (px/step 相当)。これ未満に落ち込んだら加速する。 */
  landingBoostTriggerSpeed?: number;
  /** 着地加速で加える速度の大きさ。 */
  landingBoostSpeed?: number;
}

export interface LauncherPart {
  bodies: Matter.Body[];
  sensor: Matter.Body;
  update(
    engine: Matter.Engine,
    deltaMs: number,
    onLaunch?: (ballId: number) => void,
    onLandingBoost?: (ballId: number) => void
  ): void;
  /** 発射済みボールの追跡状態を破棄する (発射台本体は静的で位置は変化しないため対象外)。 */
  reset(): void;
}

/**
 * 発射後、sensor から出られないまま再発射待ちになり続けることを防ぐ上限時間 (ms)。
 * 正常な発射なら着地まで数百 ms 程度で完了するため、十分に余裕を持たせた値。
 */
const LAUNCH_TIMEOUT_MS = 1500;

/** 最大整列ステップ数 (詰まり防止保護: 2秒 = 120ステップ) */
const MAX_ALIGN_STEPS = 120;

/**
 * 着地加速の判定を始めるまでの猶予 (ms)。発射直後の上昇軌道は十分高速
 * (実測で 6〜7 px/step 相当) なので landingBoostTriggerSpeed だけでも誤発火は
 * しない想定だが、念のため発射直後の判定を避ける猶予を設ける。
 */
const LANDING_BOOST_MIN_ELAPSED_MS = 300;

interface LaunchState {
  elapsedMs: number;
  alignSteps: number;
  originalMask: number;
  boosted: boolean;
  launched: boolean;
}

/**
 * シーソーから受け取ったボールを右上方向へ打ち出す発射装置。
 */
export function createLauncher(options: LauncherOptions = {}): LauncherPart {
  const x = options.x ?? 1150;
  const y = options.y ?? 470;
  const launchVx = options.launchVx ?? 14.0;
  const launchVy = options.launchVy ?? -16.5;
  const color = options.color ?? BIRCH_SHADOW_COLOR;

  const landingBoostTriggerSpeed = options.landingBoostTriggerSpeed ?? 3.0;
  const landingBoostSpeed = options.landingBoostSpeed ?? 3.5;

  // 坂の下り方向。長さ方向 (cosθ, sinθ) の逆ベクトル。
  const downhill =
    options.landingAngle !== undefined
      ? { x: -Math.cos(options.landingAngle), y: -Math.sin(options.landingAngle) }
      : null;

  // 発射台の底面（左下がりにしてボールを発射位置へ導く）
  const base = Matter.Bodies.rectangle(x, y + 20, 100, 16, {
    isStatic: true,
    angle: 0.1,
    label: "launcher_base",
    plugin: { color, material: "metal", moving: false },
  });

  // 右側のストッパー壁。
  // ※ sensor 範囲から完全に離し、打ち出し直後のボールの右上への軌道と接触しない位置
  // (x + 75, y + 18) に置く。base の傾斜だけで中央へ導けるため、sensor の右端に近いと
  // 発射直後のボールと衝突し、上昇中に跳ね返されて再度 sensor に落ちて再発射される
  // 無限ループの原因になっていた。
  const backWall = Matter.Bodies.rectangle(x + 75, y + 18, 14, 25, {
    isStatic: true,
    label: "launcher_wall",
    plugin: { color, material: "metal", moving: false },
  });

  // センサー領域。
  // ※ base 上面と重なる範囲を含めると、発射位置固定や接地面とのめり込みで
  // ボールがランダムな方向へ弾かれて着地点が大きく乱れる原因になるため、
  // base 上面より確実に上の薄い範囲 (y - 20) に限定する。
  // ※ 幅を 220 に広く確保している理由: シーソー側シュートからの自由落下で
  // ボールが sensor 範囲を飛び越えて手前の ramp2 に直接着地してしまわないようにするため。
  const sensorCenterY = y - 20;
  const sensor = Matter.Bodies.rectangle(x, sensorCenterY, 220, 40, {
    isStatic: true,
    isSensor: true,
    label: "launcher_sensor",
    plugin: { color: "transparent" },
  });

  const launchedBalls = new Map<number, LaunchState>();
  let wasReset = false;

  return {
    bodies: [base, backWall, sensor],
    sensor,
    update(
      engine: Matter.Engine,
      deltaMs: number,
      onLaunch?: (ballId: number) => void,
      onLandingBoost?: (ballId: number) => void
    ): void {
      const isResetState = wasReset;
      wasReset = false;

      const bodies = Matter.Composite.allBodies(engine.world);
      const balls = bodies.filter((b) => b.label === "ball");
      const seenIds = new Set<number>();

      const tryLandingBoost = (ball: Matter.Body, state: LaunchState): void => {
        if (
          !downhill ||
          state.boosted ||
          state.elapsedMs < LANDING_BOOST_MIN_ELAPSED_MS
        ) {
          return;
        }
        const v = ball.velocity;
        const speed = Math.hypot(v.x, v.y);
        if (speed < landingBoostTriggerSpeed) {
          state.boosted = true;
          Matter.Body.setVelocity(ball, {
            x: v.x + downhill.x * landingBoostSpeed,
            y: v.y + downhill.y * landingBoostSpeed,
          });
          onLandingBoost?.(
            (ball.plugin as { ballData?: { id: number } })?.ballData?.id ?? 0
          );
        }
      };

      for (const ball of balls) {
        const ballId = (ball.plugin as { ballData?: { id: number } })?.ballData?.id;
        if (!ballId) continue;
        seenIds.add(ballId);

        // ボール中心がセンサー領域内にあるかを判定 (220 x 40)
        const inSensor =
          Math.abs(ball.position.x - x) <= 110 &&
          Math.abs(ball.position.y - sensorCenterY) <= 20;

        if (inSensor) {
          if (!launchedBalls.has(ballId)) {
            const origMask = ball.collisionFilter?.mask ?? 0xffffffff;
            launchedBalls.set(ballId, {
              elapsedMs: 0,
              alignSteps: 0,
              originalMask: origMask,
              boosted: false,
              launched: false,
            });
          }

          const state = launchedBalls.get(ballId)!;

          if (!state.launched) {
            // 整列引き込み中は衝突を一時的に無効化し、シュート等との物理干渉を防ぐ
            if (ball.collisionFilter) {
              ball.collisionFilter.mask = 0;
            }

            state.alignSteps += 1;
            const targetX = x;
            const targetY = sensorCenterY;

            const dx = targetX - ball.position.x;
            const dy = targetY - ball.position.y;
            const dist = Math.hypot(dx, dy);

            // 段階的な最大移動距離 (1px -> 2px -> 3px -> 4px で頭打ち)
            const maxStepDist = Math.min(state.alignSteps, 4);

            if (
              dist <= maxStepDist ||
              state.alignSteps >= MAX_ALIGN_STEPS ||
              isResetState
            ) {
              // 整列完了時またはタイムアウト(120ステップ)時に衝突判定を復元し発射する
              if (ball.collisionFilter) {
                ball.collisionFilter.mask = state.originalMask;
              }
              Matter.Body.setPosition(ball, { x: targetX, y: targetY });
              Matter.Body.setVelocity(ball, { x: launchVx, y: launchVy });
              state.launched = true;
              state.elapsedMs = 0;
              state.alignSteps = 0;
              onLaunch?.(ballId);
            } else {
              // 毎ステップ最大 4px ずつ発射位置へスムーズに寄せる
              const ux = dx / dist;
              const uy = dy / dist;
              Matter.Body.setPosition(ball, {
                x: ball.position.x + ux * maxStepDist,
                y: ball.position.y + uy * maxStepDist,
              });
              Matter.Body.setVelocity(ball, { x: 0, y: 0 });
            }
          } else {
            if (ball.collisionFilter && ball.collisionFilter.mask === 0) {
              ball.collisionFilter.mask = state.originalMask;
            }
            state.elapsedMs += deltaMs;
            if (state.elapsedMs >= LAUNCH_TIMEOUT_MS) {
              state.launched = false;
              state.elapsedMs = LAUNCH_TIMEOUT_MS;
              state.alignSteps = 0;
            } else {
              tryLandingBoost(ball, state);
            }
          }
        } else if (launchedBalls.has(ballId)) {
          const state = launchedBalls.get(ballId);
          if (state) {
            if (ball.collisionFilter && ball.collisionFilter.mask === 0) {
              ball.collisionFilter.mask = state.originalMask;
            }

            const distSq = (ball.position.x - x) ** 2 + (ball.position.y - y) ** 2;
            if (distSq > 150 ** 2) {
              launchedBalls.delete(ballId);
              continue;
            }

            state.elapsedMs += deltaMs;

            if (state.elapsedMs >= LAUNCH_TIMEOUT_MS) {
              launchedBalls.delete(ballId);
              continue;
            }

            tryLandingBoost(ball, state);
          }
        }
      }

      for (const [id] of launchedBalls.entries()) {
        if (!seenIds.has(id)) {
          launchedBalls.delete(id);
        }
      }
    },
    reset(): void {
      launchedBalls.clear();
      wasReset = true;
    },
  };
}
