import Matter from "matter-js";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../config";
import { runFixedSteps } from "../lib/frame-scheduler";
import { createNudgeTracker, type NudgeSample } from "../lib/nudge";
import { createRng } from "../lib/random";
import { nextSpawnDelay, shouldSpawnBall } from "../lib/spawn-policy";
import { createStallTracker, type StallSample } from "../lib/stall";
import { createTimestepCalculator } from "../lib/timestep";
import { fitWorldToCanvas, type ViewportTransform } from "../lib/viewport";
import { renderWorld } from "../render/renderer";
import { createBall, getBallData } from "./ball";
import { createBounceFloor } from "./parts/bounce-floor";
import { createBranchGate } from "./parts/branch-gate";
import { createDominoRow } from "./parts/domino";
import { createElevator } from "./parts/elevator";
import { createLauncher } from "./parts/launcher";
import { createPendulum } from "./parts/pendulum";
import { createRamp } from "./parts/ramp";
import { createSeesaw } from "./parts/seesaw";
import { createWheel } from "./parts/wheel";
import { createPitagoraWorld } from "./world";

export interface SimulationConfig {
  maxActiveBalls?: number;
  seed?: number;
  fixedDeltaMs?: number;
  maxStepsPerFrame?: number;
  minSpawnDelayMs?: number;
  maxSpawnDelayMs?: number;
  stallDurationMs?: number;
}

export interface SimulationInstance {
  stop(): void;
  step?(deltaMs: number): void;
}

/** nudge 1 回あたりに加える速度の大きさ。ランダムな方向へ軽く押す程度に留める。 */
const NUDGE_SPEED = 2.2;

export function startSimulation(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  config: SimulationConfig = {}
): SimulationInstance {
  // issue #4: 「同時に流れるボール」を要望どおり増やす。issue #3 時点では
  // 発射装置〜ramp2 着地点の減速と、ドミノ列で新規ボールが検知され続けて
  // 復帰待ちがリセットされ続ける問題により、4 個同時稼働だと坂1序盤
  // (分岐ゲート〜ドミノ) や着地点で団子化していたため 3 に抑えていた。
  // 今回、着地点の減速には launcher の着地加速 (landingAngle) を、ドミノ列の
  // 復帰待ちには「新規ボール検知時のみリセット」への変更 (domino.ts) を
  // それぞれ入れて詰まる構造そのものを直したため、5 に増やしても実測で
  // 団子化しないことを確認できた (5 分間の稼働で recoveredBalls が悪化しない)。
  const maxActiveBalls = config.maxActiveBalls ?? 5;
  const seed = config.seed ?? 12345;
  const fixedDeltaMs = config.fixedDeltaMs ?? 16.666;
  const maxStepsPerFrame = config.maxStepsPerFrame ?? 5;
  // issue #3 で坂1上に分岐ゲート・振り子・ドミノ列が増え、1 周にかかる時間が
  // 伸びた。投入間隔を詰めて周回中のボール数を確保することで、60 秒の計測
  // 窓の中でも坂2のホイール・バウンド床・エレベーターまで到達するボールが
  // 安定して出るようにする (実測でギリギリ届かない回があったため調整)。
  const minSpawnDelayMs = config.minSpawnDelayMs ?? 2800;
  const maxSpawnDelayMs = config.maxSpawnDelayMs ?? 4200;
  const stallDurationMs = config.stallDurationMs ?? 4500;

  const rng = createRng(seed);
  const { engine } = createPitagoraWorld();

  const timestepCalc = createTimestepCalculator({
    fixedDeltaMs,
    maxStepsPerFrame,
  });

  const stallTracker = createStallTracker({
    minTravelDistance: 20,
    stallDurationMs,
  });

  // 押し出し (nudge)。経路 (勾配・摩擦・着地条件・仕掛けの間隔) の見直しを
  // 優先して詰まりの大半を解消したうえで、それでも残る局所的な停滞に対する
  // 保険として使う (nudge を最初の手段にしない)。stallDurationMs (4500ms) より
  // 短い nudgeThresholdMs (1200ms) で先に軽く押し、なお動かなければ
  // maxNudgeCount (3 回) で諦めて stall 検知による回収に委ねる。
  const nudgeTracker = createNudgeTracker({
    minTravelDistance: 20,
    nudgeThresholdMs: 1200,
    cooldownMs: 500,
    maxNudgeCount: 3,
  });

  // --- コースパーツの配置 ---

  // 1. 坂 1 (左210, 125 -> 右830, 305)
  const ramp1 = createRamp({
    x: 520,
    y: 215,
    length: 650,
    angle: 0.28,
    friction: 0.001,
    hasGuard: true,
    guardHeight: 12,
    label: "ramp1",
  });

  // 2. シーソー (支点 900, 350, 長さ 260)
  const seesaw = createSeesaw({
    x: 900,
    y: 350,
    length: 260,
  });

  // 坂1右端 (832, 305) からシーソー支点 (900) を越えた位置 (936, 329) への接続シュート。
  // 支点より左側にボールを着地させると常に左下がりトルクしか発生せず傾かないため、
  // 支点を越えた位置へ導いて着地直後から右を沈めるトルクを発生させる。
  // 右端をシーソー board 初期姿勢の上面 (y≈339) より約 10px 上に離し、静止状態で
  // board と重ならないようにする (めり込むと Matter.js の押し戻しでシーソーの初期姿勢が
  // 開始直後に暴れて右へ傾いたまま戻らなくなる)。勾配は緩めすぎるとボールが途中で
  // 失速して団子状に止まるため、十分に転がり落ちる角度を確保する。
  const ramp1ToSeesawChute = createRamp({
    x: 884.1,
    y: 317,
    length: 106.3,
    angle: 0.231,
    friction: 0.001,
    hasGuard: true,
    label: "chute0",
  });

  // シーソー右端付近 (1000, 385) から launcher sensor 内 (1160, 425) への接続シュート。
  // 旧配置は sensor 手前で自由落下する区間があり、水平速度がほとんど無いまま
  // 真下の ramp2 (x=1140 で上面 y≈458) に着地して止まっていた。
  // 右端を sensor 範囲内・ramp2 上面から 26px 以上離れた高さに置き、
  // friction を高めて速度を落とすことで、坂を降りたボールが確実に sensor 内へ
  // 入るようにする。
  const seesawToLauncherChute = createRamp({
    x: 1080,
    y: 405,
    length: 164.9,
    angle: 0.244,
    friction: 0.03,
    label: "chute1",
  });

  // 3. 発射装置 (1140, 460 付近 -> 右上へ打ち出し、ramp2 (1216, 424 付近) へ着地)
  // 強すぎる初速度 (旧 vx20,vy-15) だと放物線が WORLD_WIDTH(1600) を越え、
  // catcherBackWall に直撃して跳ね返り、再度 launcher sensor へ落ちて再発射される
  // 無限ループの原因になっていた (孤立シミュレーションで実測)。
  // 着地点は ramp2 右端 (x=1316.5) から十分な余裕 (100px 前後) を持たせる必要がある。
  // 余裕が無いと、着地後の残速度で坂の外へ滑り出してしまう。
  //
  // landingAngle 以下は着地加速の設定。Node で launcher の弾道を再現したところ、
  // 着地時の衝突で接線方向速度の大半を失い、着地から 700〜900ms 後に速度が
  // ほぼ 0 になることを確認した (摩擦・反発係数の調整では改善せず、円形ボディが
  // 転がることによる並進加速度の目減りが支配的)。ramp2 を急勾配に作り直すと
  // wheel (x=650) / bounce_floor (x=850) など下流ギミックの接続位置が総崩れに
  // なるため、発射した本人のボールだけを追跡できる launcher 側で着地後の
  // 速度を補正する。
  const launcher = createLauncher({
    x: 1140,
    y: 460,
    launchVx: 5.5,
    launchVy: -4.2,
    landingAngle: -0.325,
    landingBoostTriggerSpeed: 3.0,
    landingBoostSpeed: 3.5,
  });

  // 4. 坂 2 (右1320, 410 -> 左460, 690)
  const ramp2 = createRamp({
    x: 890,
    y: 550,
    length: 900,
    angle: -0.325,
    friction: 0.001,
    hasGuard: true,
    guardHeight: 12,
    label: "ramp2",
  });

  // 発射されたボールを受けるキャッチャー背面壁。ramp2 着地点 (1216 付近、
  // 複数ボールが同時稼働する実環境では衝突で右へ弾かれることもある) から
  // 適度に離しつつ、弾かれたボールが画面外や床まで落ちないよう受け止める高さを確保する
  const catcherBackWall = Matter.Bodies.rectangle(1400, 380, 14, 140, {
    isStatic: true,
    label: "catcher_wall",
    plugin: { color: "#8e44ad" },
  });

  // 坂 2 からエレベーターへの接続シュート (左463, 694 -> 左287, 730)
  // ボールがエレベーターの受け皿を飛び越えないよう、勾配を緩め坂2本体より摩擦を上げて減速させる
  const ramp2ToElevatorChute = createRamp({
    x: 375.3,
    y: 711.6,
    length: 180,
    angle: -0.2,
    friction: 0.05,
    hasGuard: true,
    label: "chute2",
  });

  // 床脱落防止ガード（エレベーター周り）
  // エレベーター受け皿左壁 (x=230) の外側に配置し、飛び越えたボールを最終的に受け止める
  const elevatorCatchFence = Matter.Bodies.rectangle(205, 735, 12, 150, {
    isStatic: true,
    label: "fence",
    plugin: { color: "#34495e" },
  });

  // 5. エレベーター (x=300, bottomY=740, topY=120)
  const elevator = createElevator({
    x: 300,
    bottomY: 740,
    topY: 120,
    speed: 300,
  });

  // エレベーター上部から坂1への受け渡しガイド
  const elevatorToRamp1Guide = createRamp({
    x: 260,
    y: 115,
    length: 90,
    angle: 0.28,
    friction: 0.001,
    label: "guide_top",
  });

  // --- 追加ギミック (issue #3) ---
  // 既存のコアループ (ramp1 / seesaw / launcher / ramp2 / elevator とそれらを
  // つなぐシュート) は issue #2 で検証済みのため位置・角度を一切変更しない。
  // 新しい仕掛けは ramp1・ramp2 という長い直線区間の「上」に追加のボディとして
  // 載せる形で挿入し、既存のシュート同士の接続点には触れない。

  // 6. 分岐ゲート (坂1の序盤、ボールがガイドから坂1へ乗り移った直後)
  // 通過したボールの速度を左右いずれかへ振り分ける (route-choice.ts の
  // 偏り補正付き重み選択を使用)。既存経路そのものを分けるのではなく、
  // ボール自身の速度を launcher と同じ手法で書き換えることで安全に振り分ける。
  const branchGate = createBranchGate({
    x: 380,
    y: 165,
    width: 120,
    height: 100,
    leftWeight: 1,
    rightWeight: 1,
    maxStreak: 4,
  });

  // 7. 振り子 (坂1の中盤上空、一定周期で振れて通過するボールを叩く)
  // 腕の長さは「最下点でも坂1を転がる最大径のボールの上端より確実に高い位置に
  // とどまる」よう安全マージンを持たせている。振り子の実測では、坂の表面すれすれ
  // まで届く設定にすると通過するボールを継続的に弾き飛ばし、団子状の詰まりを
  // 誘発することが確認できたため (実測で確認済み)。通過検知は sensor 側で
  // 独立して広く取っているため、腕を浅くしても gimmicks.pendulum の計測には
  // 影響しない。
  const pendulum = createPendulum({
    pivotX: 520,
    pivotY: 50,
    armLength: 78,
    bobRadius: 15,
    periodMs: 2100,
    amplitudeRad: 0.6,
    sensorY: 195,
    sensorWidth: 160,
    sensorHeight: 100,
  });

  // 8. ドミノ列 (坂1の終盤、専用の高摩擦プラットフォームの上に立てる)
  // 坂1本体は低摩擦 (約 0.001 相当) にボールを速く転がすチューニングがされて
  // いるため、ドミノを直接その上に置くと自重で滑り落ちてしまう。
  // y は坂1の実際の転がり面 (中心線から見て開放側、厚み分だけ上) に
  // プラットフォーム自身の厚みの半分を足した高さに合わせている。実測で
  // 坂1面より高く浮かせて配置すると「壁」になりボールが登れず完全停止する
  // ことを確認したため、必ず実測 (ball の bounds) で検証してから調整すること。
  const dominoRow = createDominoRow({
    x: 700,
    y: 265,
    angle: 0.28,
    count: 4,
    spacing: 34,
    dominoHeight: 14,
    recoveryWaitMs: 800,
  });

  // 9. 回転ホイール (坂2の序盤上空、定速回転しボールを弾く)
  const wheel = createWheel({
    x: 650,
    y: 558,
    radius: 14,
    bladeLength: 100,
    angularSpeed: 4.0,
    sensorY: 615,
    sensorWidth: 180,
    sensorHeight: 100,
  });

  // 10. バウンドする床 (坂2の中盤、通過したボールを開放側へ跳ね上げる)
  // y は坂2の実際の転がり面に床自身の厚みの半分を足した高さ (domino_platform
  // と同じ計算方法)。
  const bounceFloor = createBounceFloor({
    x: 850,
    y: 564,
    angle: -0.325,
    bounceSpeed: 6.5,
  });

  Matter.Composite.add(engine.world, [
    ...ramp1.bodies,
    ...ramp1ToSeesawChute.bodies,
    ...seesaw.bodies,
    ...seesawToLauncherChute.bodies,
    ...launcher.bodies,
    ...ramp2.bodies,
    catcherBackWall,
    ...ramp2ToElevatorChute.bodies,
    elevatorCatchFence,
    ...elevator.bodies,
    ...elevatorToRamp1Guide.bodies,
    ...branchGate.bodies,
    ...pendulum.bodies,
    ...dominoRow.bodies,
    ...wheel.bodies,
    ...bounceFloor.bodies,
  ]);
  Matter.Composite.add(engine.world, seesaw.constraints);

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

  let lastTime = typeof performance !== "undefined" ? performance.now() : 0;
  let elapsedMs = 0;
  let msSinceLastSpawn = 0;
  let nextDelayMs = nextSpawnDelay(rng, minSpawnDelayMs, maxSpawnDelayMs);
  let minActiveBalls = Infinity;
  let recoveredBalls = 0;
  let outOfBoundsBalls = 0;
  let hasSpawned = false;

  const gimmicks = {
    ramp1: 0,
    seesaw: 0,
    launcher: 0,
    ramp2: 0,
    elevator: 0,
    branchLeft: 0,
    branchRight: 0,
    pendulum: 0,
    domino: 0,
    wheel: 0,
    bounceFloor: 0,
    landingBoost: 0,
  };

  /**
   * ボールがセンサー領域へ入った瞬間に 1 回だけ数え、出たら記録を消す。
   * 出たときに消さないと同じボールの 2 周目以降を数えられず、統計が
   * 「通過回数」ではなく「通ったことのあるボールの数」になってしまう。
   */
  const countPassage = (
    counted: Set<number>,
    sensor: Matter.Body,
    ball: Matter.Body,
    id: number,
    onEnter: () => void
  ): void => {
    const inside = Matter.Bounds.overlaps(sensor.bounds, ball.bounds);
    if (inside && !counted.has(id)) {
      counted.add(id);
      onEnter();
    } else if (!inside && counted.has(id)) {
      counted.delete(id);
    }
  };

  const countedRamp1 = new Set<number>();
  const countedSeesaw = new Set<number>();
  const countedRamp2 = new Set<number>();

  let frameCount = 0;
  let fpsTimer = 0;
  let currentFps = 60;

  let animId = 0;
  let running = true;

  const spawnBall = (): void => {
    const ballX = 230 + (rng() * 10 - 5);
    const ballY = 70;
    const ball = createBall(rng, ballX, ballY);
    // 右下向きの初期速度を与えて投入口でのスタックを防止
    Matter.Body.setVelocity(ball, { x: 3.5, y: 1.5 });
    Matter.Composite.add(engine.world, ball);
    hasSpawned = true;
  };

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
        recoveredBalls,
        outOfBoundsBalls,
        gimmicks: { ...gimmicks },
      };
    }
  };

  updateStats();

  // 1 フレーム分の更新処理。RAF の再予約は行わない (再予約するのは loop() のみ)。
  // これを直接公開の step() から呼べるようにすることで、手動 step() 呼び出しのたびに
  // 新しい requestAnimationFrame が予約され、既存の自動ループと並行して物理・投入が
  // 多重に進行してしまう問題を防ぐ (レビュー指摘 #2)。
  const tick = (now: number): void => {
    if (!running) return;

    const frameDelta = Math.max(0, now - lastTime);
    lastTime = now;

    elapsedMs += frameDelta;

    frameCount += 1;
    fpsTimer += frameDelta;
    if (fpsTimer >= 500) {
      currentFps = Math.round((frameCount * 1000) / fpsTimer);
      frameCount = 0;
      fpsTimer = 0;
    }

    // タブのバックグラウンド復帰等で frameDelta が巨大化しても、物理エンジン以外の
    // 時間依存ロジック（エレベーター駆動・停滞検知・投入間隔）には打ち切り後の実効
    // 経過時間 (effectiveMs) を渡し、物理世界が実際に進んだ量と整合させる。生の
    // frameDelta を渡すと、物理はほぼ進んでいないのにエレベーターが瞬間移動したり、
    // 停滞検知が「数秒間動いていない」と誤判定して全ボールを回収したり、投入間隔だけ
    // 進んで復帰直後にボールが増えたりする。
    const { steps, effectiveMs } = timestepCalc.update(frameDelta);

    // launcher のセンサー通過判定・elevator のキャリア駆動と受け渡しは、ボディの位置に
    // 依存する検知・駆動であり、物理更新と同じ 1 ステップ (fixedDeltaMs) 単位で評価する
    // 必要がある。ループの外でフレームにつき 1 回 (effectiveMs 分まとめて) 評価すると、
    // 低 FPS やタブ復帰で steps が複数になったとき、物理だけがまとめて進んだ後に装置状態が
    // 1 回しか評価されず、ボールが launcher センサーを検知されずに通過したり、elevator が
    // 複数ステップ分の駆動時間を一度に処理してボールを取りこぼしたりして、装置の循環が
    // 止まりうる (レビュー指摘 #1)。停滞検知・投入間隔・統計・描画は「一定時間の変位」や
    // 積算値で判定する性質のためフレーム 1 回のままでよい。
    runFixedSteps(steps, fixedDeltaMs, {
      onPhysicsStep: (dt) => Matter.Engine.update(engine, dt),
      onDeviceStep: (dt) => {
        launcher.update(
          engine,
          dt,
          () => {
            gimmicks.launcher += 1;
          },
          () => {
            gimmicks.landingBoost += 1;
          }
        );

        elevator.update(engine, dt, () => {
          gimmicks.elevator += 1;
        });

        // 追加ギミック (issue #3): いずれもボディの位置に依存する検知・駆動
        // (回転・振動のキネマティック駆動、ボール速度の書き換え) であり、
        // launcher/elevator と同じ理由でフレーム単位ではなくステップ単位で
        // 評価する。
        branchGate.update(engine, rng, (side) => {
          if (side === "left") {
            gimmicks.branchLeft += 1;
          } else {
            gimmicks.branchRight += 1;
          }
        });

        pendulum.update(engine, dt, () => {
          gimmicks.pendulum += 1;
        });

        dominoRow.update(engine, dt, () => {
          gimmicks.domino += 1;
        });

        wheel.update(engine, dt, () => {
          gimmicks.wheel += 1;
        });

        bounceFloor.update(engine, () => {
          gimmicks.bounceFloor += 1;
        });
      },
    });

    msSinceLastSpawn += effectiveMs;

    const currentBalls = Matter.Composite.allBodies(engine.world).filter(
      (b) => b.label === "ball"
    );

    for (const ball of currentBalls) {
      const data = getBallData(ball);
      if (!data) continue;
      const id = data.id;

      // センサーから出たら記録を消す。消さないと「ボール 1 個につき 1 回」しか
      // 数えられず、周回するたびに増える wheel / domino 側のカウントと意味が
      // 食い違う（実測で ramp1 の値が周回数ではなくボール ID 数になっていた）。
      countPassage(countedRamp1, ramp1.sensor, ball, id, () => {
        gimmicks.ramp1 += 1;
      });
      countPassage(countedSeesaw, seesaw.sensor, ball, id, () => {
        gimmicks.seesaw += 1;
      });
      countPassage(countedRamp2, ramp2.sensor, ball, id, () => {
        gimmicks.ramp2 += 1;
      });
    }

    // 1. フェイルセーフ (画面外回収)
    for (const ball of currentBalls) {
      const { x, y } = ball.position;
      const isOutOfBounds =
        x < -60 || x > WORLD_WIDTH + 60 || y < -60 || y > WORLD_HEIGHT + 60;

      if (isOutOfBounds) {
        const data = getBallData(ball);
        if (data) {
          stallTracker.forget(data.id);
          nudgeTracker.forget(data.id);
          countedRamp1.delete(data.id);
          countedSeesaw.delete(data.id);
          countedRamp2.delete(data.id);
        }
        Matter.Composite.remove(engine.world, ball);
        outOfBoundsBalls += 1;
        spawnBall();
      }
    }

    // 2. 押し出し (nudge) とスタック検知。同じ位置サンプルを両方の判定で共有する。
    const validBalls = Matter.Composite.allBodies(engine.world).filter(
      (b) => b.label === "ball"
    );
    const samples: StallSample[] = [];
    const ballMap = new Map<number, Matter.Body>();

    for (const ball of validBalls) {
      const data = getBallData(ball);
      if (data) {
        samples.push({ id: data.id, x: ball.position.x, y: ball.position.y });
        ballMap.set(data.id, ball);
      }
    }

    // 2a. 押し出し (nudge)。stall 検知より短いしきい値 (1200ms) で先に軽く
    // 押す。詰まる構造そのものは経路修正 (launcher の着地加速・domino の復帰
    // 判定・elevator の待機床) で直しているため、ここに来るのは残った局所的な
    // 停滞のみを想定している。
    // エレベーターで運搬待ちのボールは「動いていない」が詰まってはいない。
    // 押し出すと待機床から弾き出して落下・回収を誘発するため、判定から外す。
    // タイマーも消しておかないと、待機を抜けた直後に押されてしまう。
    const nudgeSamples: NudgeSample[] = samples.filter((s) => {
      if (elevator.isHolding(s.id)) {
        nudgeTracker.forget(s.id);
        return false;
      }
      return true;
    });
    const nudgeIds = nudgeTracker.update(nudgeSamples, effectiveMs);

    for (const nudgeId of nudgeIds) {
      const targetBall = ballMap.get(nudgeId);
      if (targetBall) {
        const angle = rng() * Math.PI * 2;
        const v = targetBall.velocity;
        Matter.Body.setVelocity(targetBall, {
          x: v.x + Math.cos(angle) * NUDGE_SPEED,
          y: v.y + Math.sin(angle) * NUDGE_SPEED,
        });
      }
    }

    // 2b. スタック検知。nudge を試みても maxNudgeCount 回で解消しなければ、
    // 最終的にここで回収・再投入される。
    // nudge と同じ理由で、エレベーターの運搬待ちは停滞ではないため除外する。
    // ここを外さないと、エレベーターの往復（約 4 秒）が停滞のしきい値に達した
    // 場合に、正常に待っているボールを回収してしまう。
    const stallSamples: StallSample[] = samples.filter((s) => {
      if (elevator.isHolding(s.id)) {
        stallTracker.forget(s.id);
        return false;
      }
      return true;
    });
    const stalledIds = stallTracker.update(stallSamples, effectiveMs);

    for (const stalledId of stalledIds) {
      const targetBall = ballMap.get(stalledId);
      if (targetBall) {
        Matter.Composite.remove(engine.world, targetBall);
        stallTracker.forget(stalledId);
        nudgeTracker.forget(stalledId);
        countedRamp1.delete(stalledId);
        countedSeesaw.delete(stalledId);
        countedRamp2.delete(stalledId);
        recoveredBalls += 1;
        spawnBall();
      }
    }

    // 3. ボール投入制御
    const currentActiveBalls = Matter.Composite.allBodies(engine.world).filter(
      (b) => b.label === "ball"
    ).length;

    if (
      shouldSpawnBall({
        activeBalls: currentActiveBalls,
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

    renderWorld(ctx, engine, transform, cssWidth, cssHeight);
  };

  // RAF から駆動する自動ループ。1 フレーム分の更新 (tick) を実行した後、まだ稼働中なら
  // 次のフレームを予約する。RAF の再予約はここでのみ行う。
  const loop = (now: number): void => {
    tick(now);

    if (running && typeof requestAnimationFrame !== "undefined") {
      animId = requestAnimationFrame(loop);
    }
  };

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
    step(deltaMs: number): void {
      // tick() を直接呼ぶ (loop() は呼ばない)。loop() を呼ぶと呼び出しのたびに新しい
      // requestAnimationFrame が予約され、既存の自動ループと並行して進行してしまう。
      const now = lastTime + deltaMs;
      tick(now);
    },
  };
}
