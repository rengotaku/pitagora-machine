/**
 * デバッグ設定パネル (issue #6) の DOM 構築・イベント結線。
 *
 * React 等のフレームワークは使わず、素の DOM + CSS で実装する
 * (親 issue #1 Decision Log #1)。開閉状態の遷移・設定値のクランプは
 * src/lib/panel-state.ts / src/lib/panel-settings.ts の純粋関数に委譲し、
 * このファイルは DOM 構築とイベント配線だけに責務を絞る。
 */
import "./panel.css";
import {
  BALL_COUNT_MAX,
  BALL_COUNT_MIN,
  clampBallCount,
  clampGravity,
  clampSpeedScale,
  getDefaultSettings,
  GRAVITY_MAX,
  GRAVITY_MIN,
  SPEED_SCALE_MAX,
  SPEED_SCALE_MIN,
} from "../lib/panel-settings";
import {
  closeOnEscape,
  handleInsideClick,
  handleOutsideClick,
  togglePanel,
} from "../lib/panel-state";
import type { SimulationInstance } from "../machine/simulation";
import { createDebugHud } from "./debug-hud";

// Material Design Icons "settings" のパスデータ (Apache License 2.0)。
// アイコンフォント/ライブラリは追加せず、パスをインラインで直接埋め込む。
const GEAR_ICON_PATH =
  "M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z";

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const el = root.querySelector<T>(selector);
  if (!el) {
    throw new Error(`設定パネル: 要素が見つかりません (${selector})`);
  }
  return el;
}

/**
 * 設定ボタンとパネルを body に追加し、simulation の制御 API に結線する。
 * 通常時はパネルを隠し、ボタン押下時だけ開く。もう一度押す / 外側クリック /
 * Esc で閉じる。
 */
export function mountSettingsPanel(simulation: SimulationInstance): void {
  const defaults = getDefaultSettings();
  let isOpen = false;

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className = "pg-panel-toggle";
  toggleButton.id = "pg-panel-toggle";
  toggleButton.setAttribute("aria-expanded", "false");
  toggleButton.setAttribute("aria-controls", "pg-panel");
  toggleButton.setAttribute("aria-label", "設定を開く");
  toggleButton.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="${GEAR_ICON_PATH}"></path></svg>`;

  const panel = document.createElement("div");
  panel.className = "pg-panel";
  panel.id = "pg-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "設定");
  panel.hidden = true;
  panel.innerHTML = `
    <p class="pg-panel-title">設定</p>
    <div class="pg-panel-row">
      <label for="pg-gravity">重力</label>
      <input type="range" id="pg-gravity" min="${GRAVITY_MIN}" max="${GRAVITY_MAX}" step="0.05" value="${defaults.gravity}">
      <output for="pg-gravity" class="pg-panel-value"></output>
    </div>
    <div class="pg-panel-row">
      <label for="pg-ball-count">ボール数</label>
      <input type="range" id="pg-ball-count" min="${BALL_COUNT_MIN}" max="${BALL_COUNT_MAX}" step="1" value="${defaults.ballCount}">
      <output for="pg-ball-count" class="pg-panel-value"></output>
    </div>
    <div class="pg-panel-row">
      <label for="pg-speed">速度</label>
      <input type="range" id="pg-speed" min="${SPEED_SCALE_MIN}" max="${SPEED_SCALE_MAX}" step="0.05" value="${defaults.speedScale}">
      <output for="pg-speed" class="pg-panel-value"></output>
    </div>
    <div class="pg-panel-row pg-panel-row--checkbox">
      <label for="pg-debug">デバッグ表示</label>
      <input type="checkbox" id="pg-debug">
    </div>
    <button type="button" class="pg-panel-reset" id="pg-reset">リセット</button>
  `;

  document.body.appendChild(toggleButton);
  document.body.appendChild(panel);

  const gravityInput = requireElement<HTMLInputElement>(panel, "#pg-gravity");
  const gravityValue = requireElement<HTMLOutputElement>(
    panel,
    'output[for="pg-gravity"]'
  );
  const ballCountInput = requireElement<HTMLInputElement>(panel, "#pg-ball-count");
  const ballCountValue = requireElement<HTMLOutputElement>(
    panel,
    'output[for="pg-ball-count"]'
  );
  const speedInput = requireElement<HTMLInputElement>(panel, "#pg-speed");
  const speedValue = requireElement<HTMLOutputElement>(panel, 'output[for="pg-speed"]');
  const debugInput = requireElement<HTMLInputElement>(panel, "#pg-debug");
  const resetButton = requireElement<HTMLButtonElement>(panel, "#pg-reset");

  const hud = createDebugHud();

  const formatGravity = (value: number): string => value.toFixed(2);
  const formatSpeed = (value: number): string => `${value.toFixed(2)}x`;

  gravityValue.textContent = formatGravity(defaults.gravity);
  ballCountValue.textContent = String(defaults.ballCount);
  speedValue.textContent = formatSpeed(defaults.speedScale);

  // --- 開閉状態の反映 ---
  const syncVisibility = (): void => {
    panel.hidden = !isOpen;
    toggleButton.setAttribute("aria-expanded", String(isOpen));
    toggleButton.setAttribute("aria-label", isOpen ? "設定を閉じる" : "設定を開く");
    if (isOpen) {
      gravityInput.focus();
    }
  };

  toggleButton.addEventListener("click", (event) => {
    // document 側の click リスナー (外側クリック判定) にまで伝播すると、
    // 開いた直後の同一クリックが「外側クリック」と誤認されて即座に閉じてしまうため止める。
    event.stopPropagation();
    isOpen = togglePanel(isOpen);
    syncVisibility();
  });

  document.addEventListener("click", (event) => {
    if (!isOpen) return;
    const target = event.target as Node;
    const clickedInside = panel.contains(target);
    isOpen = clickedInside ? handleInsideClick(isOpen) : handleOutsideClick(isOpen);
    syncVisibility();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const next = closeOnEscape(isOpen);
    if (next === isOpen) return;
    isOpen = next;
    syncVisibility();
    toggleButton.focus();
  });

  // --- 設定値の反映 (重力・速度は稼働中のまま反映。ワールド再構築はしない) ---
  gravityInput.addEventListener("input", () => {
    const value = clampGravity(gravityInput.valueAsNumber);
    gravityValue.textContent = formatGravity(value);
    simulation.setGravity(value);
  });

  ballCountInput.addEventListener("input", () => {
    const value = clampBallCount(ballCountInput.valueAsNumber);
    ballCountValue.textContent = String(value);
    simulation.setMaxActiveBalls(value);
  });

  speedInput.addEventListener("input", () => {
    const value = clampSpeedScale(speedInput.valueAsNumber);
    speedValue.textContent = formatSpeed(value);
    simulation.setSpeedScale(value);
  });

  debugInput.addEventListener("change", () => {
    simulation.setDebugEnabled(debugInput.checked);
    hud.setVisible(debugInput.checked);
  });

  resetButton.addEventListener("click", () => {
    // 装置 (ボール・統計) を初期状態に戻す。あわせて重力・ボール数上限・速度も
    // 既定値に戻し、パネルの表示もそれに追従させる (デバッグ表示は作業中の
    // 表示切替であって「装置の状態」ではないため、リセット対象に含めない)。
    simulation.reset();
    simulation.setGravity(defaults.gravity);
    simulation.setMaxActiveBalls(defaults.ballCount);
    simulation.setSpeedScale(defaults.speedScale);

    gravityInput.value = String(defaults.gravity);
    gravityValue.textContent = formatGravity(defaults.gravity);
    ballCountInput.value = String(defaults.ballCount);
    ballCountValue.textContent = String(defaults.ballCount);
    speedInput.value = String(defaults.speedScale);
    speedValue.textContent = formatSpeed(defaults.speedScale);
  });
}
