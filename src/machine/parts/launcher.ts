import Matter from "matter-js";
import { STEEL_COLOR } from "../../config";

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

export interface LauncherComponent {
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

/**
 * 着地加速の判定を始めるまでの猶予 (ms)。発射直後の上昇軌道は十分高速
 * (実測で 6〜7 px/step 相当) なので landingBoostTriggerSpeed だけでも誤発火は
 * しない想定だが、念のため発射直後の判定を避ける猶予を設ける。
 */
const LANDING_BOOST_MIN_ELAPSED_MS = 300;

interface LaunchState {
  elapsedMs: number;
  boosted: boolean;
}

/**
 * シーソーから受け取ったボールを右上方向へ打ち出す発射装置。
 */
export function createLauncher(options: LauncherOptions = {}): LauncherComponent {
  const x = options.x ?? 1150;
  const y = options.y ?? 470;
  const launchVx = options.launchVx ?? 14.0;
  const launchVy = options.launchVy ?? -16.5;
  const color = options.color ?? STEEL_COLOR;
  const landingBoostTriggerSpeed = options.landingBoostTriggerSpeed ?? 3.0;
  const landingBoostSpeed = options.landingBoostSpeed ?? 3.5;
  // 坂の下り方向。長さ方向 (cosθ, sinθ) の逆ベクトル。
  const downhill =
    options.landingAngle !== undefined
      ? { x: -Math.cos(options.landingAngle), y: -Math.sin(options.landingAngle) }
      : null;

  // 発射台の底面（傾斜をつけてボールを中央へ導く。金属製）
  const base = Matter.Bodies.rectangle(x, y + 20, 100, 16, {
    isStatic: true,
    angle: 0.1,
    label: "launcher_base",
    plugin: { color, material: "metal", moving: false },
  });

  // 右側のストッパー壁（sensor 範囲から完全に離し、打ち出し直後のボールの
  // 右上への軌道と接触しない位置に置く。base の傾斜だけで中央へ導けるため、
  // sensor の右端に近いと発射直後のボールと衝突し、上昇中に跳ね返されて
  // 再度 sensor に落ちて再発射される無限ループの原因になっていた）
  const backWall = Matter.Bodies.rectangle(x + 75, y + 18, 14, 25, {
    isStatic: true,
    label: "launcher_wall",
    plugin: { color, material: "metal", moving: false },
  });

  // センサー領域。base 上面 (y-5 付近の base 中心 y+20, 厚み16の上面 ≈ y+12) と
  // 重なる範囲を含めると、発射位置固定 (setPosition) の際にボールが base に
  // めり込み、めり込み解消でランダムな方向へ弾かれて着地点が大きく乱れる原因に
  // なるため、base 上面より確実に上の薄い範囲に限定する。
  // 幅は、シーソー側シュートからの自由落下でボールが sensor 範囲を飛び越えて
  // 手前の ramp2 に直接着地してしまわないよう、広めに確保する。
  const sensorCenterY = y - 20;
  const sensor = Matter.Bodies.rectangle(x, sensorCenterY, 220, 40, {
    isStatic: true,
    isSensor: true,
    label: "launcher_sensor",
    plugin: { color: "transparent" },
  });

  // ballId -> 発射してからの状態。sensor から出た距離だけでなく経過時間でも
  // タイムアウトさせる (下記 update 内コメント参照)。
  const launchedBalls = new Map<number, LaunchState>();

  return {
    bodies: [base, backWall, sensor],
    sensor,
    update(
      engine: Matter.Engine,
      deltaMs: number,
      onLaunch?: (ballId: number) => void,
      onLandingBoost?: (ballId: number) => void
    ): void {
      const bodies = Matter.Composite.allBodies(engine.world);
      const balls = bodies.filter((b) => b.label === "ball");
      const seenIds = new Set<number>();

      // 着地加速: 発射から一定時間経過し、かつ十分減速したボールに坂の下り方向の
      // 速度を 1 回だけ加える。このボールは launcher が発射した本人であると
      // 確定している (sensor で検知して発射したボールの ID しか launchedBalls に
      // 入らない) ため、着地点付近をたまたま通過する無関係なボール (シーソー側の
      // シュートを降りてくるボール等) を誤って加速する心配がない。位置ベースの
      // 専用センサーで同じことをしようとすると、着地点・発射直後の飛行軌道・
      // 隣接するシュートの出口が空間的に重なり、無関係なボールを誤検知して
      // しまう (実測で確認)。sensor の内外どちらでも判定できるよう、この
      // 補正だけは inSensor の分岐に関わらず共通に評価する (着地点の座標が
      // ボール半径次第で sensor 範囲に食い込むことがあり、sensor 外のケースだけに
      // 限定すると判定が抜け落ちるボールが出るため)。
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

        const inSensor = Matter.Bounds.overlaps(sensor.bounds, ball.bounds);

        if (inSensor) {
          if (!launchedBalls.has(ballId)) {
            launchedBalls.set(ballId, { elapsedMs: 0, boosted: false });
            // sensor 内のどこでボールが検知されたかによって発射位置がばらつくと、
            // 着地点が大きく揺れて ramp2 を外れたり catcherBackWall に接触したり
            // する原因になるため、発射位置を sensor 中心に固定してから
            // 一定の軌道で右上へ力強く射出する
            Matter.Body.setPosition(ball, { x, y: sensorCenterY });
            Matter.Body.setVelocity(ball, { x: launchVx, y: launchVy });
            onLaunch?.(ballId);
          } else {
            // sensor 内に留まり続けている (=発射に失敗して跳ね返された、または
            // 他のボールとの衝突で押し戻された) 場合、position ベースの距離判定
            // (else 節) には一生到達できず、launchedBalls に残り続けて二度と
            // 再発射されない詰まりになっていた (実測: launcher sensor 付近の
            // 座標でスタック検知される事例を確認)。sensor 内にいても経過時間を
            // 加算し、タイムアウトしたら強制的に再発射対象へ戻す。
            const state = launchedBalls.get(ballId);
            if (state) {
              state.elapsedMs += deltaMs;
              if (state.elapsedMs >= LAUNCH_TIMEOUT_MS) {
                launchedBalls.delete(ballId);
              } else {
                tryLandingBoost(ball, state);
              }
            }
          }
        } else if (launchedBalls.has(ballId)) {
          const distSq = (ball.position.x - x) ** 2 + (ball.position.y - y) ** 2;
          if (distSq > 150 ** 2) {
            launchedBalls.delete(ballId);
            continue;
          }

          const state = launchedBalls.get(ballId);
          if (!state) continue;
          state.elapsedMs += deltaMs;

          if (state.elapsedMs >= LAUNCH_TIMEOUT_MS) {
            launchedBalls.delete(ballId);
            continue;
          }

          tryLandingBoost(ball, state);
        }
      }

      // ワールドから消えた (回収・脱落) ボールの記録は破棄し、Map が無限に育たないようにする
      for (const id of launchedBalls.keys()) {
        if (!seenIds.has(id)) {
          launchedBalls.delete(id);
        }
      }
    },
    reset(): void {
      launchedBalls.clear();
    },
  };
}
