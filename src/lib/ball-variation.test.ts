import { describe, expect, it } from "vitest";
import { createRng } from "./random";
import {
  DEFAULT_BALL_VARIATION_RANGE,
  generateBallVariation,
  type BallVariationRange,
} from "./ball-variation";

const COLORS = ["#e74c3c", "#3498db", "#2ecc71"];

describe("ball-variation (TC-1 ~ TC-4)", () => {
  it("TC-1: シード付き乱数で 500 個生成すると、すべて定義した最小〜最大の範囲に収まる", () => {
    const rng = createRng(1);
    for (let i = 0; i < 500; i += 1) {
      const v = generateBallVariation(rng, COLORS);
      expect(v.radius).toBeGreaterThanOrEqual(DEFAULT_BALL_VARIATION_RANGE.minRadius);
      expect(v.radius).toBeLessThanOrEqual(DEFAULT_BALL_VARIATION_RANGE.maxRadius);
    }
  });

  it("TC-2: 同じシードで 2 回生成すると完全に同じ系列になる (再現性)", () => {
    const rngA = createRng(777);
    const rngB = createRng(777);

    const seriesA = Array.from({ length: 500 }, () =>
      generateBallVariation(rngA, COLORS)
    );
    const seriesB = Array.from({ length: 500 }, () =>
      generateBallVariation(rngB, COLORS)
    );

    expect(seriesA).toEqual(seriesB);
  });

  it("TC-3: 500 個生成するとサイズが 3 種類以上に分かれる (全部同じにならない)", () => {
    const rng = createRng(2);
    const radii = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      radii.add(Math.round(generateBallVariation(rng, COLORS).radius));
    }
    expect(radii.size).toBeGreaterThanOrEqual(3);
  });

  it("TC-4: 生成された個体は質量・反発が物理的に妥当な範囲に収まる (反発 0〜1、質量が正)", () => {
    const rng = createRng(3);
    for (let i = 0; i < 500; i += 1) {
      const v = generateBallVariation(rng, COLORS);
      expect(v.restitution).toBeGreaterThanOrEqual(0);
      expect(v.restitution).toBeLessThanOrEqual(1);
      // 質量は density * 面積 (πr^2) に比例する。density・radius が正である
      // ことが「質量が正」の必要十分条件になる。
      expect(v.density).toBeGreaterThan(0);
      expect(v.radius).toBeGreaterThan(0);
      const mass = Math.PI * v.radius ** 2 * v.density;
      expect(mass).toBeGreaterThan(0);
    }
  });

  it("追加テスト: color は渡した候補配列の中から選ばれる", () => {
    const rng = createRng(4);
    for (let i = 0; i < 50; i += 1) {
      const v = generateBallVariation(rng, COLORS);
      expect(COLORS).toContain(v.color);
    }
  });

  it("追加テスト: 不正な範囲 (min > max、負の radius/density、0-1 外の restitution) は例外を投げる", () => {
    const rng = createRng(5);
    const base = DEFAULT_BALL_VARIATION_RANGE;

    const invalidRadius: BallVariationRange = { ...base, minRadius: 20, maxRadius: 10 };
    expect(() => generateBallVariation(rng, COLORS, invalidRadius)).toThrow();

    const negativeRadius: BallVariationRange = { ...base, minRadius: -5, maxRadius: 10 };
    expect(() => generateBallVariation(rng, COLORS, negativeRadius)).toThrow();

    const outOfRangeRestitution: BallVariationRange = {
      ...base,
      minRestitution: 0.5,
      maxRestitution: 1.5,
    };
    expect(() => generateBallVariation(rng, COLORS, outOfRangeRestitution)).toThrow();

    const negativeDensity: BallVariationRange = {
      ...base,
      minDensity: -0.001,
      maxDensity: 0.002,
    };
    expect(() => generateBallVariation(rng, COLORS, negativeDensity)).toThrow();
  });
});
