/**
 * 装置の「毎回少しずつ違う」挙動を作るための乱数ユーティリティ。
 *
 * `Math.random` を直接使わずシード付き生成器を挟むのは、詰まりを再現したいときに
 * 同じ乱数列を再生できるようにするため。
 */

/** 0 以上 1 未満の値を返す乱数生成器。 */
export type Rng = () => number;

/**
 * mulberry32 によるシード付き乱数生成器を作る。
 * 同じシードからは常に同じ系列が得られる。
 */
export function createRng(seed: number): Rng {
  if (!Number.isFinite(seed)) {
    throw new Error(`seed は有限の数値である必要があります: ${seed}`);
  }
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** min 以上 max 未満の実数を返す。 */
export function randomRange(rng: Rng, min: number, max: number): number {
  if (!(min <= max)) {
    throw new Error(`min は max 以下である必要があります: min=${min}, max=${max}`);
  }
  return min + rng() * (max - min);
}

/** min 以上 max 以下の整数を返す（両端を含む）。 */
export function randomInt(rng: Rng, min: number, max: number): number {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  if (!(lo <= hi)) {
    throw new Error(`整数範囲が空です: min=${min}, max=${max}`);
  }
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** 配列から 1 要素を等確率で選ぶ。 */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error("空の配列からは選択できません");
  }
  return items[randomInt(rng, 0, items.length - 1)];
}

/**
 * 重み付きで 1 要素を選ぶ。重みは正の数であること。
 * ルート分岐の偏りを与えるために使う。
 */
export function pickWeighted<T>(
  rng: Rng,
  items: readonly T[],
  weights: readonly number[]
): T {
  if (items.length === 0) {
    throw new Error("空の配列からは選択できません");
  }
  if (items.length !== weights.length) {
    throw new Error(
      `items と weights の長さが一致しません: ${items.length} vs ${weights.length}`
    );
  }
  let total = 0;
  for (const weight of weights) {
    if (!(weight >= 0) || !Number.isFinite(weight)) {
      throw new Error(`weight は 0 以上の有限値である必要があります: ${weight}`);
    }
    total += weight;
  }
  if (total <= 0) {
    throw new Error("weights の合計が 0 です");
  }
  let threshold = rng() * total;
  for (let i = 0; i < items.length; i += 1) {
    threshold -= weights[i];
    if (threshold < 0) {
      return items[i];
    }
  }
  // 浮動小数の誤差で末尾を超えた場合の保険。
  return items[items.length - 1];
}

/** probability（0〜1）の確率で true を返す。 */
export function chance(rng: Rng, probability: number): boolean {
  if (!(probability >= 0 && probability <= 1)) {
    throw new Error(`probability は 0〜1 である必要があります: ${probability}`);
  }
  if (probability === 0) {
    return false;
  }
  if (probability === 1) {
    return true;
  }
  return rng() < probability;
}
