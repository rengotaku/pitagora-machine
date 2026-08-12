import { describe, expect, it } from "vitest";
import { chance, createRng, pick, pickWeighted, randomInt, randomRange } from "./random";

describe("createRng", () => {
  it("同じシードからは同じ系列を返す", () => {
    const a = createRng(1234);
    const b = createRng(1234);
    const seriesA = [a(), a(), a(), a(), a()];
    const seriesB = [b(), b(), b(), b(), b()];
    expect(seriesA).toEqual(seriesB);
  });

  it("異なるシードでは異なる系列を返す", () => {
    const a = createRng(1);
    const b = createRng(2);
    expect([a(), a(), a()]).not.toEqual([b(), b(), b()]);
  });

  it("常に 0 以上 1 未満を返す", () => {
    const rng = createRng(42);
    for (let i = 0; i < 500; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it("有限でないシードを拒否する", () => {
    expect(() => createRng(Number.NaN)).toThrow(/有限/);
  });
});

describe("randomRange", () => {
  it("指定範囲に収まる", () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i += 1) {
      const value = randomRange(rng, -3, 8.5);
      expect(value).toBeGreaterThanOrEqual(-3);
      expect(value).toBeLessThan(8.5);
    }
  });

  it("min と max が同じなら常にその値を返す", () => {
    const rng = createRng(7);
    expect(randomRange(rng, 5, 5)).toBe(5);
  });

  it("min > max を拒否する", () => {
    const rng = createRng(7);
    expect(() => randomRange(rng, 10, 1)).toThrow(/min は max 以下/);
  });
});

describe("randomInt", () => {
  it("両端を含む整数を返す", () => {
    const rng = createRng(99);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      const value = randomInt(rng, 1, 3);
      expect(Number.isInteger(value)).toBe(true);
      seen.add(value);
    }
    expect(seen).toEqual(new Set([1, 2, 3]));
  });

  it("範囲が空なら例外を投げる", () => {
    const rng = createRng(99);
    expect(() => randomInt(rng, 3, 1)).toThrow(/整数範囲が空/);
  });
});

describe("pick", () => {
  it("配列の要素を返す", () => {
    const rng = createRng(5);
    const items = ["a", "b", "c"] as const;
    for (let i = 0; i < 100; i += 1) {
      expect(items).toContain(pick(rng, items));
    }
  });

  it("空配列を拒否する", () => {
    const rng = createRng(5);
    expect(() => pick(rng, [])).toThrow(/空の配列/);
  });
});

describe("pickWeighted", () => {
  it("重み 0 の要素は選ばれない", () => {
    const rng = createRng(11);
    const items = ["left", "right"] as const;
    for (let i = 0; i < 200; i += 1) {
      expect(pickWeighted(rng, items, [1, 0])).toBe("left");
    }
  });

  it("重みの比率がおおよそ反映される", () => {
    const rng = createRng(2024);
    const items = ["left", "right"] as const;
    let right = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i += 1) {
      if (pickWeighted(rng, items, [1, 3]) === "right") {
        right += 1;
      }
    }
    expect(right / trials).toBeGreaterThan(0.65);
    expect(right / trials).toBeLessThan(0.85);
  });

  it("長さ不一致・不正な重み・空配列を拒否する", () => {
    const rng = createRng(11);
    expect(() => pickWeighted(rng, ["a"], [1, 2])).toThrow(/長さが一致しません/);
    expect(() => pickWeighted(rng, ["a"], [-1])).toThrow(/0 以上の有限値/);
    expect(() => pickWeighted(rng, ["a"], [0])).toThrow(/合計が 0/);
    expect(() => pickWeighted(rng, [], [])).toThrow(/空の配列/);
  });
});

describe("chance", () => {
  it("0 と 1 は乱数を消費せず確定値を返す", () => {
    const rng = createRng(3);
    expect(chance(rng, 0)).toBe(false);
    expect(chance(rng, 1)).toBe(true);
  });

  it("確率がおおよそ反映される", () => {
    const rng = createRng(777);
    let hits = 0;
    const trials = 2000;
    for (let i = 0; i < trials; i += 1) {
      if (chance(rng, 0.25)) {
        hits += 1;
      }
    }
    expect(hits / trials).toBeGreaterThan(0.18);
    expect(hits / trials).toBeLessThan(0.32);
  });

  it("範囲外の確率を拒否する", () => {
    const rng = createRng(3);
    expect(() => chance(rng, 1.5)).toThrow(/0〜1/);
    expect(() => chance(rng, -0.1)).toThrow(/0〜1/);
  });
});
