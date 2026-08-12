import Matter from "matter-js";
import { shouldRecoverDominoes } from "../../lib/domino-recovery";

export interface DominoRowOptions {
  x: number;
  y: number;
  angle?: number;
  count?: number;
  spacing?: number;
  dominoWidth?: number;
  dominoHeight?: number;
  platformLength?: number;
  platformThickness?: number;
  recoveryWaitMs?: number;
  fallenAngleThreshold?: number;
  color?: string;
  label?: string;
}

export interface DominoRowComponent {
  bodies: Matter.Body[];
  dominoes: Matter.Body[];
  sensor: Matter.Body;
  update(
    engine: Matter.Engine,
    deltaMs: number,
    onPass?: (ballId: number) => void,
    onRecovered?: () => void
  ): void;
}

/** 角度差を [-π, π] へ正規化する (ドミノが何周も回転しても誤判定しないため)。 */
function normalizedAngleDiff(a: number, b: number): number {
  let diff = (a - b) % (Math.PI * 2);
  if (diff > Math.PI) diff -= Math.PI * 2;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

/**
 * ボールが当たると連鎖して倒れるドミノ列。
 *
 * 既存の坂は低摩擦 (friction ≈ 0.001) にボールを速く転がすためのチューニングが
 * 施されているため、ドミノを直接その上に置くと自重で滑り落ちてしまう。
 * そのため専用の高摩擦プラットフォームを坂の表面に重ねて設置し、その上に
 * ドミノを立てる。何枚か倒れて一定時間ボールの接触が無いと
 * src/lib/domino-recovery.ts の判定に従って自動で起こし直す。
 */
export function createDominoRow(options: DominoRowOptions): DominoRowComponent {
  const angle = options.angle ?? 0;
  const count = options.count ?? 5;
  const spacing = options.spacing ?? 20;
  const dominoWidth = options.dominoWidth ?? 8;
  const dominoHeight = options.dominoHeight ?? 28;
  const platformThickness = options.platformThickness ?? 8;
  const recoveryWaitMs = options.recoveryWaitMs ?? 2200;
  const fallenAngleThreshold = options.fallenAngleThreshold ?? 0.6;
  const color = options.color ?? "#f39c12";
  const label = options.label ?? "domino";

  const rowLength = spacing * (count - 1);
  const platformLength = options.platformLength ?? rowLength + dominoWidth * 6;

  // along: 坂/プラットフォームの長さ方向 (cosθ, sinθ)
  // normal: ボールが転がる開放側 (角度 0 で真上になる) 方向 (sinθ, -cosθ)
  const dir = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: Math.sin(angle), y: -Math.cos(angle) };

  const platform = Matter.Bodies.rectangle(
    options.x,
    options.y,
    platformLength,
    platformThickness,
    {
      isStatic: true,
      angle,
      friction: 0.85,
      label: `${label}_platform`,
      plugin: { color: "#a5673f" },
    }
  );

  const platformTopOffset = platformThickness / 2;

  const dominoes: Matter.Body[] = [];
  const restStates: { x: number; y: number; angle: number }[] = [];

  const startAlong = -rowLength / 2;
  for (let i = 0; i < count; i += 1) {
    const along = startAlong + i * spacing;
    // わずかな隙間 (2px) を空けて重力で自然に着地させる (静的プラットフォームへの
    // 初期めり込みによる予期しない弾き飛ばしを避けるため)。
    const perp = platformTopOffset + dominoHeight / 2 + 2;
    const dx = options.x + dir.x * along + normal.x * perp;
    const dy = options.y + dir.y * along + normal.y * perp;

    // density を低くしてボールとの衝突で運動量を奪いすぎないようにする。
    // frictionStatic は既定 (0.5) のままにし、ボール側との接触摩擦を
    // 押し上げない (プラットフォームとの摩擦は friction (min 合成) だけで
    // 十分に確保できる)。
    const domino = Matter.Bodies.rectangle(dx, dy, dominoWidth, dominoHeight, {
      angle,
      friction: 0.85,
      restitution: 0.02,
      density: 0.0008,
      label,
      plugin: { color },
    });
    dominoes.push(domino);
    restStates.push({ x: dx, y: dy, angle });
  }

  const sensorPerp = platformTopOffset + dominoHeight + 25;
  const sensorCenterX = options.x + normal.x * sensorPerp;
  const sensorCenterY = options.y + normal.y * sensorPerp;
  const sensor = Matter.Bodies.rectangle(
    sensorCenterX,
    sensorCenterY,
    platformLength * 0.95,
    dominoHeight + 50,
    {
      isStatic: true,
      isSensor: true,
      angle,
      label: `${label}_sensor`,
      plugin: { color: "transparent" },
    }
  );

  const passedBalls = new Set<number>();
  let msSinceLastContact = recoveryWaitMs;

  return {
    bodies: [platform, ...dominoes, sensor],
    dominoes,
    sensor,
    update(
      engine: Matter.Engine,
      deltaMs: number,
      onPass?: (ballId: number) => void,
      onRecovered?: () => void
    ): void {
      const balls = Matter.Composite.allBodies(engine.world).filter(
        (b) => b.label === "ball"
      );

      // 「新規にセンサーへ入ってきたボールがいるか」だけで msSinceLastContact を
      // リセットする (touchedNow = センサー内に誰かいるか、ではない)。
      // 複数ボールが連続してドミノ列に詰まった場合、touchedNow 方式だと
      // 団子の中のボールがセンサー内に居座り続ける限り msSinceLastContact が
      // 常に 0 に戻り、復帰待機時間 (recoveryWaitMs) に絶対到達せず、詰まった
      // ドミノが永久に起き上がらない悪循環になっていた (実測で確認)。
      // 新規流入のみをリセット条件にすることで、団子状態でも新しいボールの
      // 流入が止まれば一定時間後に強制的に起こし直せるようにする。
      let hasNewContact = false;
      for (const ball of balls) {
        const ballId = (ball.plugin as { ballData?: { id: number } })?.ballData?.id;
        if (!ballId) continue;

        const inSensor = Matter.Bounds.overlaps(sensor.bounds, ball.bounds);
        if (inSensor) {
          if (!passedBalls.has(ballId)) {
            passedBalls.add(ballId);
            hasNewContact = true;
            onPass?.(ballId);
          }
        } else if (passedBalls.has(ballId)) {
          passedBalls.delete(ballId);
        }
      }

      msSinceLastContact = hasNewContact ? 0 : msSinceLastContact + deltaMs;

      let fallenCount = 0;
      for (let i = 0; i < dominoes.length; i += 1) {
        const diff = normalizedAngleDiff(dominoes[i].angle, restStates[i].angle);
        if (Math.abs(diff) > fallenAngleThreshold) {
          fallenCount += 1;
        }
      }

      const shouldRecover = shouldRecoverDominoes({
        fallenCount,
        totalCount: dominoes.length,
        msSinceLastContact,
        recoveryWaitMs,
      });

      if (shouldRecover && fallenCount > 0) {
        for (let i = 0; i < dominoes.length; i += 1) {
          const domino = dominoes[i];
          const rest = restStates[i];
          Matter.Body.setPosition(domino, { x: rest.x, y: rest.y });
          Matter.Body.setAngle(domino, rest.angle);
          Matter.Body.setVelocity(domino, { x: 0, y: 0 });
          Matter.Body.setAngularVelocity(domino, 0);
        }
        onRecovered?.();
      }
    },
  };
}
