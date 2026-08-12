/**
 * デバッグ表示 (issue #6) が有効なときだけ画面に重ねるテキストオーバーレイ。
 *
 * fps・アクティブ/最小ボール数・停滞回収回数・画面外回収回数・仕掛けごとの
 * 作動回数を表示する。当たり判定の描画 (isSensor ボディ) は Canvas 座標変換の
 * 都合上 src/render/renderer.ts 側が担当するため、ここでは window.__pitagora を
 * ポーリングして更新するテキスト表示だけに責務を絞る。
 */

export interface DebugHud {
  setVisible(visible: boolean): void;
  destroy(): void;
}

/** window.__pitagora のポーリング間隔。fps 自体も 500ms 周期でしか更新されないため十分な頻度。 */
const UPDATE_INTERVAL_MS = 250;

export function createDebugHud(): DebugHud {
  const el = document.createElement("pre");
  el.className = "pg-debug-hud";
  el.setAttribute("aria-hidden", "true");
  el.hidden = true;
  document.body.appendChild(el);

  const render = (): void => {
    const stats = window.__pitagora;
    if (!stats) return;

    const gimmickLines = Object.entries(stats.gimmicks)
      .map(([name, count]) => `  ${name}: ${count}`)
      .join("\n");

    el.textContent = [
      `fps: ${stats.fps}`,
      `balls: ${stats.activeBalls} (min ${stats.minActiveBalls})`,
      `stall recovered: ${stats.recoveredBalls}  out-of-bounds: ${stats.outOfBoundsBalls}`,
      "gimmicks:",
      gimmickLines,
    ].join("\n");
  };

  let timerId: ReturnType<typeof setInterval> | undefined;

  return {
    setVisible(visible: boolean): void {
      el.hidden = !visible;

      if (visible) {
        render();
        if (timerId === undefined) {
          timerId = setInterval(render, UPDATE_INTERVAL_MS);
        }
      } else if (timerId !== undefined) {
        clearInterval(timerId);
        timerId = undefined;
      }
    },
    destroy(): void {
      if (timerId !== undefined) {
        clearInterval(timerId);
        timerId = undefined;
      }
      el.remove();
    },
  };
}
