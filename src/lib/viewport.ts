/**
 * 論理ワールド座標を画面へ写すための変換。
 *
 * 装置は固定サイズの論理座標系で組み立て、表示時にウィンドウへ収める。
 * こうしないとウィンドウサイズごとに装置のレイアウトが変わり、
 * 「どのサイズでも詰まらない」ことを検証できなくなる。
 */
export interface ViewportTransform {
  /** 論理座標 1 単位あたりの画面ピクセル数 */
  scale: number;
  /** 画面左端から装置左端までの余白 (CSS px) */
  offsetX: number;
  /** 画面上端から装置上端までの余白 (CSS px) */
  offsetY: number;
}

/**
 * アスペクト比を保ったままワールド全体がキャンバスに収まる変換を求める。
 * 余った領域は上下または左右へ均等に振り分ける（レターボックス）。
 */
export function fitWorldToCanvas(
  worldWidth: number,
  worldHeight: number,
  canvasWidth: number,
  canvasHeight: number
): ViewportTransform {
  assertPositive("worldWidth", worldWidth);
  assertPositive("worldHeight", worldHeight);
  assertPositive("canvasWidth", canvasWidth);
  assertPositive("canvasHeight", canvasHeight);

  const scale = Math.min(canvasWidth / worldWidth, canvasHeight / worldHeight);
  return {
    scale,
    offsetX: (canvasWidth - worldWidth * scale) / 2,
    offsetY: (canvasHeight - worldHeight * scale) / 2,
  };
}

/** 画面座標 (CSS px) を論理ワールド座標へ戻す。ポインタ操作の判定に使う。 */
export function screenToWorld(
  transform: ViewportTransform,
  screenX: number,
  screenY: number
): { x: number; y: number } {
  return {
    x: (screenX - transform.offsetX) / transform.scale,
    y: (screenY - transform.offsetY) / transform.scale,
  };
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} は正の有限値である必要があります: ${value}`);
  }
}
