import Matter from "matter-js";
import { STAGE_COLOR, SURROUND_COLOR, WORLD_HEIGHT, WORLD_WIDTH } from "../config";
import type { ViewportTransform } from "../lib/viewport";
import { getBallData } from "../machine/ball";

/**
 * Canvas 2D で Matter.js の world ボディを描画する。
 * Matter.js の Render は使用せず、Canvas 2D を自前制御する。
 * fitWorldToCanvas でワールド→画面変換し、装置全体が常に画面に収まるようにする。
 */
export function renderWorld(
  ctx: CanvasRenderingContext2D,
  engine: Matter.Engine,
  transform: ViewportTransform,
  cssWidth: number,
  cssHeight: number
): void {
  // 1. レターボックス領域の背景塗りつぶし
  ctx.fillStyle = SURROUND_COLOR;
  ctx.fillRect(0, 0, cssWidth, cssHeight);

  // 2. 装置（論理ワールド）領域の座標変換
  ctx.save();
  ctx.translate(transform.offsetX, transform.offsetY);
  ctx.scale(transform.scale, transform.scale);

  ctx.fillStyle = STAGE_COLOR;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  ctx.strokeStyle = "#d4c8b5";
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

  // 3. 全 Body の描画
  const bodies = Matter.Composite.allBodies(engine.world);

  for (const body of bodies) {
    if (body.label === "ball") {
      const data = getBallData(body);
      const radius = data?.radius ?? 15;
      const color = data?.color ?? "#e74c3c";

      // ボール本体
      ctx.beginPath();
      ctx.arc(body.position.x, body.position.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      ctx.strokeStyle = "rgba(0, 0, 0, 0.2)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // ボールの回転表現用ライン
      ctx.beginPath();
      ctx.moveTo(body.position.x, body.position.y);
      ctx.lineTo(
        body.position.x + Math.cos(body.angle) * radius * 0.8,
        body.position.y + Math.sin(body.angle) * radius * 0.8
      );
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (!body.isSensor) {
      // isSensor な通過検知ボディ（ramp/launcher/elevator 等のセンサー矩形）は非表示。
      // デバッグ表示が必要になったらここにフラグ分岐を追加する。
      // 多角形（壁、床、坂パーツ）
      const vertices = body.vertices;
      if (vertices.length > 0) {
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        for (let i = 1; i < vertices.length; i += 1) {
          ctx.lineTo(vertices[i].x, vertices[i].y);
        }
        ctx.closePath();

        const customColor = (body.plugin as { color?: string })?.color;
        ctx.fillStyle = customColor ?? "#7f8c8d";
        ctx.fill();

        ctx.strokeStyle = "#2c3e50";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }

  ctx.restore();
}
