import { describe, expect, it } from "vitest";
import {
  closeOnEscape,
  handleInsideClick,
  handleOutsideClick,
  togglePanel,
} from "./panel-state";

describe("panel-state (TC-7 ~ TC-12)", () => {
  it("TC-7: 閉じている状態でトグルすると開く", () => {
    expect(togglePanel(false)).toBe(true);
  });

  it("TC-8: 開いている状態でトグルすると閉じる", () => {
    expect(togglePanel(true)).toBe(false);
  });

  it("TC-9: 開いている状態で Esc を受け取ると閉じる", () => {
    expect(closeOnEscape(true)).toBe(false);
  });

  it("TC-10: 閉じている状態で Esc を受け取ると閉じたまま (余計な状態変化を起こさない)", () => {
    expect(closeOnEscape(false)).toBe(false);
  });

  it("TC-11: 開いている状態で外側クリックを受け取ると閉じる", () => {
    expect(handleOutsideClick(true)).toBe(false);
  });

  it("TC-12: 開いている状態でパネル内部のクリックを受け取ると開いたまま", () => {
    expect(handleInsideClick(true)).toBe(true);
  });

  it("追加テスト: 閉じている状態で外側クリックを受け取っても閉じたまま / handleOutsideClick の isOpen=false 分岐カバレッジ確認のため", () => {
    expect(handleOutsideClick(false)).toBe(false);
  });

  it("追加テスト: 閉じている状態で内部クリックを受け取っても閉じたまま / handleInsideClick の isOpen=false 分岐確認のため", () => {
    expect(handleInsideClick(false)).toBe(false);
  });
});
