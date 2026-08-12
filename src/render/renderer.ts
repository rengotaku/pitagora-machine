import Matter from "matter-js";
import {
  INK_COLOR,
  STAGE_COLOR,
  STEEL_COLOR,
  SURROUND_COLOR,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from "../config";
import type { ViewportTransform } from "../lib/viewport";
import { getBallData } from "../machine/ball";

/**
 * Canvas 2D で Matter.js の world ボディを描画する。
 * Matter.js の Render は使用せず、Canvas 2D を自前制御する。
 * fitWorldToCanvas でワールド→画面変換し、装置全体が常に画面に収まるようにする。
 *
 * 素材 (木/金属) や動く/静止の区別は各パーツ生成コード (machine/parts/*.ts) が
 * body.plugin に埋め込む { color, material, moving } を見て描き分ける
 * (物理挙動には一切使われない自由領域)。
 */

interface PartVisual {
  color: string;
  material?: "wood" | "metal";
  moving: boolean;
}

// 輪郭線: 動くパーツは濃く太く、静止パーツは控えめにして視覚的に区別する (issue #5)。
// INK_COLOR (#3b4348) の RGB値をそのまま rgba() の薄め版として使う。
const MOVING_STROKE_COLOR = INK_COLOR;
const MOVING_STROKE_WIDTH = 2.6;
const STATIC_STROKE_COLOR = "rgba(59, 67, 72, 0.55)";
const STATIC_STROKE_WIDTH = 1.3;

const WOOD_GRAIN_COLOR = "rgba(185, 140, 78, 0.5)"; // birch-shadow を薄く
const SCREW_HEAD_COLOR = "#8b98a0"; // steel よりわずかに落ち着かせたネジ頭
const SCREW_STROKE_COLOR = "rgba(59, 67, 72, 0.6)";

const BALL_STROKE_COLOR = "rgba(59, 67, 72, 0.35)";
const BALL_HIGHLIGHT_COLOR = "rgba(255, 255, 255, 0.55)";
const BALL_SPIN_LINE_COLOR = "rgba(255, 255, 255, 0.5)";
const FALLBACK_BALL_COLOR = "#e8552f";
const FALLBACK_PART_COLOR = STEEL_COLOR;

// デバッグ表示 (issue #6) 用の当たり判定の輪郭色。通常の輪郭・塗りとは
// 明確に区別できる目立つ色にし、破線にして「これは実体ではなく検知範囲」と
// 分かるようにする。
const DEBUG_SENSOR_STROKE_COLOR = "rgba(232, 85, 47, 0.9)";
const DEBUG_SENSOR_DASH: [number, number] = [6, 4];

export function renderWorld(
  ctx: CanvasRenderingContext2D,
  engine: Matter.Engine,
  transform: ViewportTransform,
  cssWidth: number,
  cssHeight: number,
  debugEnabled = false
): void {
  // 1. レターボックス領域の背景塗りつぶし
  ctx.fillStyle = SURROUND_COLOR;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  // 2. 装置（論理ワールド）領域の座標変換
  ctx.save();
  ctx.translate(transform.offsetX, transform.offsetY);
  ctx.scale(transform.scale, transform.scale);

  // 装置全体の影。ステージ本体よりわずかに右下へオフセットした薄い矩形を
  // 先に敷き、その上にステージ本体を重ねることで下端・右端にだけ影を覗かせる。
  // shadowBlur は使わず単色矩形 1 枚に留めて描画コストを抑える。
  ctx.fillStyle = "rgba(59, 67, 72, 0.16)";
  ctx.fillRect(10, 14, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.fillStyle = STAGE_COLOR;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.strokeStyle = STATIC_STROKE_COLOR;
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // 3. 全 Body の描画
  const bodies = Matter.Composite.allBodies(engine.world);

  for (const body of bodies) {
    if (body.label === "ball") {
      drawBall(ctx, body);
    } else if (!body.isSensor) {
      // Matter.js は Body.create で全ボディに circleRadius: 0 を既定値として
      // 持たせる (undefined ではない) ため、真偽値判定 (truthy) で見る。
      // !== undefined で判定すると矩形ボディまで「円」と誤認され、
      // radius=0 で描画が消える (実測で確認)。
      if (body.circleRadius) {
        drawCirclePart(ctx, body);
      } else {
        drawPolygonPart(ctx, body);
      }
    } else if (debugEnabled) {
      // isSensor な通過検知ボディ（ramp/launcher/elevator 等のセンサー矩形）は
      // 通常時は非表示。デバッグ表示が有効なときだけ、ここで初めて輪郭を
      // 重ねて可視化する (issue #6)。
      drawDebugSensor(ctx, body);
    }
  }

  ctx.restore();
}

/**
 * isSensor なボディ（通過検知の当たり判定）の輪郭を破線で描画する。
 * デバッグ表示が有効なときだけ呼ばれる。実体の色・塗りとは異なる目立つ色にし、
 * 「検知範囲であって実体ではない」ことが一目でわかるようにする。
 */
function drawDebugSensor(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
  ctx.save();
  ctx.setLineDash(DEBUG_SENSOR_DASH);
  ctx.strokeStyle = DEBUG_SENSOR_STROKE_COLOR;
  ctx.lineWidth = 1.5;

  if (body.circleRadius) {
    ctx.beginPath();
    ctx.arc(body.position.x, body.position.y, body.circleRadius, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const vertices = body.vertices;
    if (vertices.length > 0) {
      ctx.beginPath();
      ctx.moveTo(vertices[0].x, vertices[0].y);
      for (let i = 1; i < vertices.length; i += 1) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.restore();
}

function getPartVisual(body: Matter.Body): PartVisual {
  const plugin = body.plugin as
    { color?: string; material?: "wood" | "metal"; moving?: boolean } | undefined;
  return {
    color: plugin?.color ?? FALLBACK_PART_COLOR,
    material: plugin?.material,
    moving: plugin?.moving ?? false,
  };
}

function drawBall(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
  const data = getBallData(body);
  const radius = data?.radius ?? 15;
  const color = data?.color ?? FALLBACK_BALL_COLOR;
  const { x, y } = body.position;

  // ボール本体（くすんだ玩具色）
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.strokeStyle = BALL_STROKE_COLOR;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 光沢ハイライト（左上寄りの小さい円。玩具のプラスチック感を軽く出す程度に留める）
  const highlightRadius = radius * 0.3;
  const highlightOffset = radius * 0.38;
  ctx.beginPath();
  ctx.arc(x - highlightOffset, y - highlightOffset, highlightRadius, 0, Math.PI * 2);
  ctx.fillStyle = BALL_HIGHLIGHT_COLOR;
  ctx.fill();

  // ボールの回転表現用ライン（動きの手がかりとして残す）
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(
    x + Math.cos(body.angle) * radius * 0.8,
    y + Math.sin(body.angle) * radius * 0.8
  );
  ctx.strokeStyle = BALL_SPIN_LINE_COLOR;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawCirclePart(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
  const visual = getPartVisual(body);
  const radius = body.circleRadius ?? 10;

  ctx.beginPath();
  ctx.arc(body.position.x, body.position.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = visual.color;
  ctx.fill();

  ctx.strokeStyle = visual.moving ? MOVING_STROKE_COLOR : STATIC_STROKE_COLOR;
  ctx.lineWidth = visual.moving ? MOVING_STROKE_WIDTH : STATIC_STROKE_WIDTH;
  ctx.stroke();
}

function drawPolygonPart(ctx: CanvasRenderingContext2D, body: Matter.Body): void {
  const vertices = body.vertices;
  if (vertices.length === 0) return;

  const visual = getPartVisual(body);

  ctx.beginPath();
  ctx.moveTo(vertices[0].x, vertices[0].y);
  for (let i = 1; i < vertices.length; i += 1) {
    ctx.lineTo(vertices[i].x, vertices[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = visual.color;
  ctx.fill();

  ctx.strokeStyle = visual.moving ? MOVING_STROKE_COLOR : STATIC_STROKE_COLOR;
  ctx.lineWidth = visual.moving ? MOVING_STROKE_WIDTH : STATIC_STROKE_WIDTH;
  ctx.stroke();

  // 矩形 (4 頂点) のみ、木目・取り付けネジの signature を追加する。
  if (vertices.length === 4) {
    const size = getLocalRectSize(vertices);
    if (size) {
      if (visual.material === "wood") {
        drawWoodGrain(ctx, body, size.width, size.height);
      }
      drawScrews(ctx, body, size.width, size.height);
    }
  }
}

/** ワールド座標の頂点間距離から、回転に依存しないローカルの幅・高さを求める。 */
function getLocalRectSize(
  vertices: Matter.Vector[]
): { width: number; height: number } | null {
  if (vertices.length !== 4) return null;
  return {
    width: distance(vertices[0], vertices[1]),
    height: distance(vertices[1], vertices[2]),
  };
}

function distance(a: Matter.Vector, b: Matter.Vector): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** seed から 0〜1 の決定論的な擬似乱数値を作る (Math.random は使わない)。 */
function pseudoRandom01(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 木目を薄い線で入れる。ばらつきの種には body.id (生成時に決まり以後不変) を使う。
 * body.position/angle は動くパーツで毎フレーム変わるため、そこに揺らぎの種を
 * 取ると模様がチラつく。id を種にすることで、パーツが動いても模様自体は
 * 常に同じ形になり安定する。
 */
function drawWoodGrain(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body,
  width: number,
  height: number
): void {
  const longAxis = Math.max(width, height);
  const shortAxis = Math.min(width, height);
  if (longAxis < 30 || shortAxis < 6) return;

  const rotate = width >= height ? body.angle : body.angle + Math.PI / 2;
  const grainCount = shortAxis > 22 ? 3 : 2;
  const margin = longAxis * 0.12;

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(rotate);
  ctx.strokeStyle = WOOD_GRAIN_COLOR;
  ctx.lineWidth = 1;

  for (let i = 0; i < grainCount; i += 1) {
    const t = (i + 1) / (grainCount + 1);
    const perp = -shortAxis / 2 + shortAxis * t;
    const wobble = (pseudoRandom01(body.id * 7 + i) - 0.5) * shortAxis * 0.3;
    ctx.beginPath();
    ctx.moveTo(-longAxis / 2 + margin, perp);
    ctx.quadraticCurveTo(0, perp + wobble, longAxis / 2 - margin, perp);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * 取り付けネジ (signature)。矩形の長辺方向の両端付近に 1 個ずつ描き、
 * 「工作として組まれた装置」に見せる。溝の向きは body.id から決定論的に
 * ばらつかせ、手作業でねじ込んだような不揃いさを出す。
 */
function drawScrews(
  ctx: CanvasRenderingContext2D,
  body: Matter.Body,
  width: number,
  height: number
): void {
  const longAxis = Math.max(width, height);
  const shortAxis = Math.min(width, height);
  if (longAxis < 34 || shortAxis < 7) return;

  const rotate = width >= height ? body.angle : body.angle + Math.PI / 2;
  const screwRadius = Math.min(3.2, shortAxis * 0.28);
  const inset = Math.min(longAxis * 0.16, 14);

  ctx.save();
  ctx.translate(body.position.x, body.position.y);
  ctx.rotate(rotate);

  drawScrew(ctx, -longAxis / 2 + inset, 0, screwRadius, body.id);
  drawScrew(ctx, longAxis / 2 - inset, 0, screwRadius, body.id + 1000);

  ctx.restore();
}

function drawScrew(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  seed: number
): void {
  ctx.save();
  ctx.translate(x, y);

  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fillStyle = SCREW_HEAD_COLOR;
  ctx.fill();
  ctx.strokeStyle = SCREW_STROKE_COLOR;
  ctx.lineWidth = 0.7;
  ctx.stroke();

  // 溝 (マイナスネジ)。向きを id 由来でばらつかせ、均質な工業製品に見えないようにする。
  const grooveAngle = pseudoRandom01(seed) * Math.PI;
  ctx.rotate(grooveAngle);
  ctx.beginPath();
  ctx.moveTo(-radius * 0.65, 0);
  ctx.lineTo(radius * 0.65, 0);
  ctx.strokeStyle = SCREW_STROKE_COLOR;
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.restore();
}
