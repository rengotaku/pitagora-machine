import { describe, expect, it } from "vitest";
import { createRng, type Rng } from "./random";
import { createRouteSelector, type RouteSide } from "./route-choice";

describe("route-choice (TC-1 ~ TC-4)", () => {
  it("TC-1: 左右の重みが等しいとき、シード付き乱数で 2000 回選択するとおおよそ 50:50 になる (0.4〜0.6)", () => {
    const selector = createRouteSelector({
      leftWeight: 1,
      rightWeight: 1,
      maxStreak: 1000,
    });
    const rng = createRng(42);
    let left = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i += 1) {
      if (selector.choose(rng) === "left") left += 1;
    }
    const ratio = left / trials;
    expect(ratio).toBeGreaterThan(0.4);
    expect(ratio).toBeLessThan(0.6);
  });

  it("TC-2: 左に重み3、右に重み1のとき、2000 回選択すると左が 65%〜85% になる", () => {
    const selector = createRouteSelector({
      leftWeight: 3,
      rightWeight: 1,
      maxStreak: 1000,
    });
    const rng = createRng(7);
    let left = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i += 1) {
      if (selector.choose(rng) === "left") left += 1;
    }
    const ratio = left / trials;
    expect(ratio).toBeGreaterThan(0.65);
    expect(ratio).toBeLessThan(0.85);
  });

  it("TC-3: 直近の選択が maxStreak 回連続で同じ側に偏ったら、その閾値で必ず反対側が選ばれる", () => {
    const maxStreak = 4;
    const selector = createRouteSelector({ leftWeight: 1, rightWeight: 1, maxStreak });
    // rng が常に 0 を返すと pickWeighted は常に先頭 (left) を返すため、
    // 偏り補正が無ければ left が無限に選ばれ続ける状況を決定的に作れる。
    const alwaysZeroRng: Rng = () => 0;

    const sides: RouteSide[] = [];
    for (let i = 0; i < maxStreak + 1; i += 1) {
      sides.push(selector.choose(alwaysZeroRng));
    }

    for (let i = 0; i < maxStreak; i += 1) {
      expect(sides[i]).toBe("left");
    }
    // maxStreak 回連続した直後 (閾値) では反対側が強制される
    expect(sides[maxStreak]).toBe("right");
  });

  it("追加テスト: 重みが極端に偏っていても連続選択が maxStreak を超えず、両側とも使われる / TC-3 の実運用相当の確認", () => {
    const maxStreak = 5;
    const selector = createRouteSelector({ leftWeight: 1000, rightWeight: 1, maxStreak });
    const rng = createRng(99);
    const sides: RouteSide[] = [];
    for (let i = 0; i < 300; i += 1) {
      sides.push(selector.choose(rng));
    }

    let currentStreak = 1;
    let longestStreak = 1;
    for (let i = 1; i < sides.length; i += 1) {
      currentStreak = sides[i] === sides[i - 1] ? currentStreak + 1 : 1;
      longestStreak = Math.max(longestStreak, currentStreak);
    }

    expect(longestStreak).toBeLessThanOrEqual(maxStreak);
    // 片側のルートだけが使われる状態を作らない
    expect(sides).toContain("left");
    expect(sides).toContain("right");
  });

  it("TC-4: 重みが負・NaN・全て0だと例外を投げる", () => {
    expect(() =>
      createRouteSelector({ leftWeight: -1, rightWeight: 1, maxStreak: 3 })
    ).toThrow();
    expect(() =>
      createRouteSelector({ leftWeight: Number.NaN, rightWeight: 1, maxStreak: 3 })
    ).toThrow();
    expect(() =>
      createRouteSelector({ leftWeight: 0, rightWeight: 0, maxStreak: 3 })
    ).toThrow();
  });

  it("追加テスト: maxStreak が正の整数でない場合も例外を投げる / 構築時バリデーションの網羅", () => {
    expect(() =>
      createRouteSelector({ leftWeight: 1, rightWeight: 1, maxStreak: 0 })
    ).toThrow();
    expect(() =>
      createRouteSelector({ leftWeight: 1, rightWeight: 1, maxStreak: 1.5 })
    ).toThrow();
  });

  it("追加テスト: reset() で偏り補正の連続選択カウントが破棄される (レビュー指摘 #2 回帰テスト)", () => {
    // 稼働中に片側へ streak が積み上がった状態で reset() すると、次の choose() は
    // 「連続 0 回」から再開するはず。破棄されていないと、reset 直後の 1 回目から
    // 残っていた streak の影響で偏り補正が誤発火する。
    const maxStreak = 3;
    const selector = createRouteSelector({ leftWeight: 1, rightWeight: 1, maxStreak });
    const alwaysZeroRng = () => 0;

    // maxStreak 回連続で left を選ばせ、streak を積み上げる
    for (let i = 0; i < maxStreak; i += 1) {
      expect(selector.choose(alwaysZeroRng)).toBe("left");
    }
    // 積み上げた streak を破棄せずに呼ぶと、次は偏り補正で強制的に right になる
    // (この時点ではまだ reset していないことの確認)
    expect(selector.choose(alwaysZeroRng)).toBe("right");

    selector.reset();

    // reset 後は streak が 0 に戻っているため、alwaysZeroRng (常に left を選ぶ
    // pickWeighted) が maxStreak 回連続で left を返せるはず。偏り補正が
    // 引き継がれていれば 1 回目から right になってしまう。
    for (let i = 0; i < maxStreak; i += 1) {
      expect(selector.choose(alwaysZeroRng)).toBe("left");
    }
  });
});
