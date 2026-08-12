/**
 * デバッグ設定パネルの開閉状態遷移ロジック (issue #6)。
 *
 * DOM 操作は一切行わず、現在の開閉状態 (boolean) から次状態を計算するだけの
 * 純粋関数として実装する。「クリックがパネルの内側/外側どちらだったか」の
 * 判定 (要素の contains 等) は呼び出し側 (UI 層) の責務とし、ここでは
 * 判定結果を受け取るだけにする。
 */

/** トグルボタン押下時の遷移。現在の開閉を反転する。 */
export function togglePanel(isOpen: boolean): boolean {
  return !isOpen;
}

/**
 * Esc キー押下時の遷移。
 * 開いていれば閉じる。閉じていれば何もしない (余計な状態変化を起こさない)。
 */
export function closeOnEscape(isOpen: boolean): boolean {
  return isOpen ? false : isOpen;
}

/**
 * パネル外側のクリックを受け取ったときの遷移。
 * 開いていれば閉じる。閉じていれば何もしない。
 */
export function handleOutsideClick(isOpen: boolean): boolean {
  return isOpen ? false : isOpen;
}

/**
 * パネル内部のクリックを受け取ったときの遷移。
 * 開閉状態に関わらず、内部クリックだけでは状態を変化させない。
 */
export function handleInsideClick(isOpen: boolean): boolean {
  return isOpen;
}
