import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DEFAULT_HTML, countStages, judge, runChain } from "./chain-sim.mjs";

const html = readFileSync(DEFAULT_HTML, "utf8");
const stageCount = countStages(html);
const check = (src) => judge(runChain(src), runChain(src), stageCount);
// 1 か所だけ書き換えた版を作る。書き換え元が見つからなければテストの前提が崩れているので落とす
const mutate = (from, to) => {
  expect(html.includes(from)).toBe(true);
  return html.replace(from, to);
};

describe("chain-sim: Kinetic Chain No.10 のシミュレーション", () => {
  it("段の一覧を読み取れている", () => {
    expect(stageCount).toBeGreaterThan(20);
  });

  it("現行版は全段に到達して完走し、2 回の軌道が一致する", () => {
    const v = check(html);
    expect(v.problems).toEqual([]);
    expect(v.ok).toBe(true);
  });

  // 以下は検査が素通しでないことの確認。壊した版がそれぞれの理由で不合格になる
  it("途中で止まる版は「最後まで届いていない」になる", () => {
    const v = check(mutate("this.done = true;", "this.done = false;"));
    expect(v.ok).toBe(false);
    expect(v.problems.join()).toContain("最後まで届いていない");
  });

  it("1 段が抜ける版は、その段が未到達として出る", () => {
    const v = check(mutate("this.setStage(16, g.hel.x, g.hel.y0);", ""));
    expect(v.ok).toBe(false);
    expect(v.missing).toEqual([16]);
  });

  it("座標が NaN になる版は非有限値として出る", () => {
    const v = check(mutate("A.spin += f.w * f.r * dt / R; this.funPos(A);", "A.spin += f.w * f.r * dt / R; this.funPos(A); A.x = NaN;"));
    expect(v.ok).toBe(false);
    expect(v.problems.join()).toContain("非有限値: A.x");
  });

  it("乱数が混ざる版は 2 回の軌道が一致しない", () => {
    const v = check(mutate("A.spin += f.w * f.r * dt / R; this.funPos(A);", "A.spin += f.w * f.r * dt / R; this.funPos(A); A.x += Math.random() * 1000;"));
    expect(v.ok).toBe(false);
    expect(v.problems.join()).toContain("一致しない");
  });

  it("SIM の目印や段の一覧が無いと例外になる", () => {
    expect(() => runChain("<html></html>")).toThrow("SIM-BEGIN");
    expect(() => countStages("<html></html>")).toThrow("STAGES");
  });
});
