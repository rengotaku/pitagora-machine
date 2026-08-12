/**
 * 左右に分岐するルートの選択ロジック。
 *
 * 重み付き乱数選択 (pickWeighted) をベースにしつつ、同じ側が連続で
 * maxStreak 回選ばれたら次回は必ず反対側を選ぶ「偏り補正」を持つ。
 * 補正が無いと、重みが偏っている場合に片側のルートだけが使われ続け、
 * 実質的に分岐が機能しなくなる。
 */
import type { Rng } from "./random";
import { pickWeighted } from "./random";

export type RouteSide = "left" | "right";

export interface RouteSelectorOptions {
  leftWeight: number;
  rightWeight: number;
  /** 同じ側が何回連続したら次回に反対側を強制するか。 */
  maxStreak: number;
}

export interface RouteSelector {
  choose(rng: Rng): RouteSide;
}

const SIDES: readonly RouteSide[] = ["left", "right"];

/**
 * ルート選択器を生成する。
 * leftWeight/rightWeight は 0 以上の有限値かつ合計が正である必要があり、
 * maxStreak は正の整数である必要がある。いずれかを満たさない場合は例外を投げる (TC-4)。
 */
export function createRouteSelector(options: RouteSelectorOptions): RouteSelector {
  const { leftWeight, rightWeight, maxStreak } = options;

  for (const [name, weight] of [
    ["leftWeight", leftWeight],
    ["rightWeight", rightWeight],
  ] as const) {
    if (!(weight >= 0) || !Number.isFinite(weight)) {
      throw new Error(`${name} は 0 以上の有限値である必要があります: ${weight}`);
    }
  }
  if (leftWeight + rightWeight <= 0) {
    throw new Error("leftWeight と rightWeight の合計が 0 です");
  }
  if (!Number.isInteger(maxStreak) || maxStreak <= 0) {
    throw new Error(`maxStreak は正の整数である必要があります: ${maxStreak}`);
  }

  let lastSide: RouteSide | null = null;
  let streak = 0;

  return {
    choose(rng: Rng): RouteSide {
      let side: RouteSide;

      if (lastSide !== null && streak >= maxStreak) {
        // 偏り補正: 閾値に達したら反対側を強制する (TC-3)
        side = lastSide === "left" ? "right" : "left";
      } else {
        side = pickWeighted(rng, SIDES, [leftWeight, rightWeight]);
      }

      streak = side === lastSide ? streak + 1 : 1;
      lastSide = side;

      return side;
    },
  };
}
