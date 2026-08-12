import { beforeEach, describe, expect, it } from "vitest";
import type { SimulationInstance } from "../machine/simulation";
import { mountSettingsPanel } from "./settings-panel";

/**
 * mountSettingsPanel は SimulationInstance の全メソッドを呼ぶため、テストでは
 * 呼び出し回数だけを記録する no-op なモックを渡す。
 */
function createMockSimulation(): SimulationInstance {
  return {
    stop: () => {},
    setGravity: () => {},
    setMaxActiveBalls: () => {},
    setSpeedScale: () => {},
    setDebugEnabled: () => {},
    reset: () => {},
  };
}

describe("settings-panel", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("トグルボタンを押して開くと重力入力へフォーカスする", () => {
    mountSettingsPanel(createMockSimulation());

    const toggleButton = document.querySelector<HTMLButtonElement>("#pg-panel-toggle");
    const gravityInput = document.querySelector<HTMLInputElement>("#pg-gravity");
    expect(toggleButton).not.toBeNull();
    expect(gravityInput).not.toBeNull();
    if (!toggleButton || !gravityInput) return;

    toggleButton.click();

    expect(document.activeElement).toBe(gravityInput);
  });

  it("パネル内の別要素をクリックしてもフォーカスが重力入力へ奪われない (レビュー指摘 #1 回帰テスト)", () => {
    // レビュー指摘: パネル内のスライダーやチェックボックスをクリックした場合も
    // syncVisibility() が呼ばれ、開いている限り毎回 gravityInput.focus() が
    // 実行されていた。そのためボール数スライダーをクリックすると直後に重力
    // スライダーへフォーカスが移り、矢印キー操作が意図せず重力を変えてしまっていた。
    mountSettingsPanel(createMockSimulation());

    const toggleButton = document.querySelector<HTMLButtonElement>("#pg-panel-toggle");
    const gravityInput = document.querySelector<HTMLInputElement>("#pg-gravity");
    const ballCountInput = document.querySelector<HTMLInputElement>("#pg-ball-count");
    expect(toggleButton).not.toBeNull();
    expect(gravityInput).not.toBeNull();
    expect(ballCountInput).not.toBeNull();
    if (!toggleButton || !gravityInput || !ballCountInput) return;

    // 1. 開く (初回のみ重力入力へフォーカスされる)
    toggleButton.click();
    expect(document.activeElement).toBe(gravityInput);

    // 2. パネル内の別要素 (ボール数スライダー) を実際にクリックしたときと同様、
    //    フォーカスを移してから click イベントを document までバブリングさせる
    //    (settings-panel.ts の外側/内側クリック判定は document 側の click
    //    リスナーで event.target を見て行っているため)。
    ballCountInput.focus();
    ballCountInput.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    // 3. handleInsideClick により isOpen は変化せず syncVisibility() が呼ばれるが、
    //    フォーカスは奪われず ballCountInput のまま維持されるはず。
    expect(document.activeElement).toBe(ballCountInput);
    // パネルは開いたままであることも合わせて確認する (副作用で閉じていないか)
    expect(document.querySelector<HTMLDivElement>("#pg-panel")?.hidden).toBe(false);
  });

  it("トグルボタンでもう一度閉じて再度開くと、そのときも重力入力へフォーカスする", () => {
    // 「開く」操作は毎回フォーカスするべきで、「初回だけ特別扱い」ではないことの確認。
    mountSettingsPanel(createMockSimulation());

    const toggleButton = document.querySelector<HTMLButtonElement>("#pg-panel-toggle");
    const gravityInput = document.querySelector<HTMLInputElement>("#pg-gravity");
    const ballCountInput = document.querySelector<HTMLInputElement>("#pg-ball-count");
    if (!toggleButton || !gravityInput || !ballCountInput)
      throw new Error("setup failed");

    toggleButton.click(); // 開く
    ballCountInput.focus();
    ballCountInput.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(document.activeElement).toBe(ballCountInput);

    toggleButton.click(); // 閉じる
    toggleButton.click(); // 再び開く

    expect(document.activeElement).toBe(gravityInput);
  });
});
