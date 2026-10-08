// public/chain/index.html の決定論シミュレーション（SIM-BEGIN 〜 SIM-END）だけを取り出して Node で早送りする。
// 描画や DOM には触れない部分なので、ブラウザ無しで「全段を通って最後まで届くか」「毎回同じ軌道か」を確かめられる。
//
// 使い方: node scripts/chain-sim.mjs [html のパス]
import { readFileSync } from "node:fs";
import path from "node:path";

// vitest の jsdom 環境では import.meta.url が file: にならないので、dirname から組み立てる
export const DEFAULT_HTML = path.resolve(import.meta.dirname, "../public/chain/index.html");
const BEGIN = "// ===== SIM-BEGIN =====";
const END = "// ===== SIM-END =====";
// 1 周は約 41 秒。これを大きく超えて終わらなければ、どこかで止まっている
const MAX_SECONDS = 120;
// 軌道の記録間隔（ステップ数）。1/240 秒刻みなので 0.1 秒ごと
const TRACE_EVERY = 24;

export function loadSim(html) {
  const a = html.indexOf(BEGIN);
  const b = html.indexOf(END);
  if (a < 0 || b < 0 || b < a) throw new Error("SIM-BEGIN / SIM-END の目印が見つからない");
  return new Function(html.slice(a, b) + "\nreturn { Sim, DT };")();
}

// 段の数はページ側の STAGES の要素数
export function countStages(html) {
  const body = html.match(/^const STAGES = \[([\s\S]*?)^\];/m)?.[1];
  if (!body) throw new Error("STAGES の一覧が見つからない");
  return (body.match(/\['/g) ?? []).length;
}

// 球の座標・速度を毎ステップ確かめ、一定間隔で軌道を記録する
function balls(s) {
  return [["A", s.A], ["B", s.B], ...s.C.map((c, i) => ["C" + i, c])];
}

export function runChain(html) {
  const { Sim, DT } = loadSim(html);
  const s = new Sim();
  s.start();
  const trace = [];
  let nonFinite = null;
  for (let i = 0; i < MAX_SECONDS / DT && !s.done; i++) {
    s.step(DT);
    for (const [name, b] of balls(s)) {
      for (const key of ["x", "y", "vx", "vy"]) {
        if (!nonFinite && !Number.isFinite(b[key])) nonFinite = { t: s.t, ball: name, key, phase: b.phase };
      }
    }
    if (i % TRACE_EVERY === 0) trace.push(balls(s).map(([, b]) => [b.phase, b.x, b.y]));
  }
  return { done: s.done, endT: s.endT, stageT: s.stageT.slice(), nonFinite, trace };
}

// 2 回分の結果から合否を出す。CLI とテストで同じ判定を使う
export function judge(r1, r2, stageCount) {
  const problems = [];
  if (!r1.done) problems.push("最後まで届いていない");
  if (r1.nonFinite) problems.push(`非有限値: ${r1.nonFinite.ball}.${r1.nonFinite.key}（t=${r1.nonFinite.t.toFixed(3)}, ${r1.nonFinite.phase}）`);
  const missing = [];
  for (let k = 1; k <= stageCount; k++) {
    const t = r1.stageT[k];
    if (!Number.isFinite(t) || t < 0 || t > r1.endT) missing.push(k);
  }
  if (missing.length) problems.push(`未到達の段: ${missing.join(", ")}`);
  if (JSON.stringify(r1) !== JSON.stringify(r2)) problems.push("2 回の実行で軌道か到達時刻が一致しない");
  return { ok: problems.length === 0, problems, missing };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.dirname, "chain-sim.mjs")) {
  const html = readFileSync(process.argv[2] ?? DEFAULT_HTML, "utf8");
  const r1 = runChain(html);
  const v = judge(r1, runChain(html), countStages(html));
  console.log(v.ok ? `OK: ${countStages(html)} 段すべてに到達 / ${r1.endT.toFixed(2)} s / 2 回の軌道が一致` : `NG: ${v.problems.join(" / ")}`);
  process.exit(v.ok ? 0 : 1);
}
