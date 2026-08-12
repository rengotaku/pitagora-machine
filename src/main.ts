import "./style.css";
import { STAGE_COLOR, SURROUND_COLOR, WORLD_HEIGHT, WORLD_WIDTH } from "./config";
import { fitWorldToCanvas, type ViewportTransform } from "./lib/viewport";

/**
 * キャンバスを画面いっぱいに保ち、装置の下地を描く。
 * 論理座標 (WORLD_WIDTH x WORLD_HEIGHT) は画面サイズによらず一定に保たれる。
 */
function bootstrap(canvas: HTMLCanvasElement, context: CanvasRenderingContext2D): void {
  let transform: ViewportTransform = fitWorldToCanvas(WORLD_WIDTH, WORLD_HEIGHT, 1, 1);

  const draw = (): void => {
    context.fillStyle = SURROUND_COLOR;
    context.fillRect(0, 0, window.innerWidth, window.innerHeight);

    context.save();
    context.translate(transform.offsetX, transform.offsetY);
    context.scale(transform.scale, transform.scale);
    context.fillStyle = STAGE_COLOR;
    context.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    context.restore();
  };

  const resize = (): void => {
    // devicePixelRatio をそのまま使うと 4K で描画コストが跳ね上がるため 2 で頭打ちにする。
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const cssWidth = Math.max(window.innerWidth, 1);
    const cssHeight = Math.max(window.innerHeight, 1);

    canvas.width = Math.round(cssWidth * ratio);
    canvas.height = Math.round(cssHeight * ratio);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    transform = fitWorldToCanvas(WORLD_WIDTH, WORLD_HEIGHT, cssWidth, cssHeight);
    draw();
  };

  window.addEventListener("resize", resize);
  resize();
}

const canvas = document.querySelector<HTMLCanvasElement>("#stage");
if (!canvas) {
  throw new Error("#stage の canvas が見つかりません");
}
const context = canvas.getContext("2d");
if (!context) {
  throw new Error("2D コンテキストを取得できませんでした");
}
bootstrap(canvas, context);
