#!/usr/bin/env node
/**
 * 長時間安定性の検証スクリプト (issue #6)。
 *
 * 考え方は docs/verification.md を参照。要約すると:
 *   1. Chrome DevTools Protocol (CDP) で、既に起動している headless Chrome に
 *      新しいタブを開かせ、検証対象ページ (Vite dev server) を読み込む。
 *   2. 一定間隔ごとに `window.__pitagora` (src/types.d.ts の PitagoraStats) を
 *      `Runtime.evaluate` で取得し、同時に `Page.captureScreenshot` で
 *      画面を保存する。数値だけでなく画像でも「詰まっていないか」を確認できるようにする。
 *   3. 実行完了時に、判定に使うサマリ (平均/最低 fps・最終統計・仕掛けごとの
 *      最終カウント) を追加で出力する。合否判定そのものはこのスクリプトでは行わず、
 *      docs/verification.md に明記した判定基準と照らし合わせて人が判断する
 *      (自動 CI に組み込む場合は、このサマリを元に判定を追加すればよい)。
 *
 * 使い方:
 *   node scripts/verify-stability.mjs <url> <outDir> <intervalMs> <samples> [label]
 *
 * 例 (5 分検証、60 秒間隔 x 6 回 = 6 分):
 *   CDP_PORT=9333 node scripts/verify-stability.mjs \
 *     http://localhost:5173/ ./verification-out 60000 6 stability
 *
 * 前提: headless Chrome が --remote-debugging-port=<CDP_PORT> で起動済みであること。
 * dev server / Chrome の起動・停止はこのスクリプトの責務ではない。
 */
import { extractConsoleError } from "./verify-console.mjs";

const [, , pageUrl, outDir, intervalRaw, samplesRaw, label = "run"] = process.argv;

if (!pageUrl || !outDir) {
  console.error(
    "使い方: node scripts/verify-stability.mjs <url> <outDir> <intervalMs> <samples> [label]"
  );
  process.exit(1);
}

const CDP_PORT = process.env.CDP_PORT || "9333";
const interval = Number(intervalRaw || 5000);
const samples = Number(samplesRaw || 3);

const fs = await import("node:fs/promises");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function openTarget(url) {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(url)}`, {
    method: "PUT",
  });
  if (!res.ok) throw new Error(`/json/new failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function closeTarget(id) {
  await fetch(`http://127.0.0.1:${CDP_PORT}/json/close/${id}`);
}

async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  let nextId = 0;
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  return { ws, send };
}

const target = await openTarget(pageUrl);
const { ws, send } = await connect(target.webSocketDebuggerUrl);

await send("Page.enable");
await send("Runtime.enable");

// コンソールエラーを拾う (描画が落ちていても静止画では気づけないため)。
// Runtime.exceptionThrown は「未処理の例外」しか通知しないため、検証対象が
// try/catch で捕まえたうえで console.error(...) だけで異常を報告するケースは
// これだけでは検知できない (レビュー指摘 #3)。console.error(...) 自体は
// Runtime.consoleAPICalled (type: "error") として通知されるため、あわせて購読する
// (判定ロジックは verify-console.mjs の extractConsoleError に切り出してテストする)。
const consoleErrors = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  const error = extractConsoleError(msg);
  if (error !== null) {
    consoleErrors.push(error);
  }
});

await fs.mkdir(outDir, { recursive: true });

const readings = [];
for (let i = 1; i <= samples; i += 1) {
  await sleep(interval);
  const evaluated = await send("Runtime.evaluate", {
    expression: "JSON.stringify(window.__pitagora ?? null)",
    returnByValue: true,
  });
  const raw = evaluated.result?.value ?? "null";
  readings.push({ atMs: i * interval, stats: JSON.parse(raw) });

  const shot = await send("Page.captureScreenshot", { format: "png" });
  const file = `${outDir}/${label}-${String(i * interval).padStart(6, "0")}ms.png`;
  await fs.writeFile(file, Buffer.from(shot.data, "base64"));
}

// --- 判定用サマリ ---
const validReadings = readings.filter((r) => r.stats !== null);
const fpsList = validReadings.map((r) => r.stats.fps);
const last = validReadings.at(-1)?.stats ?? null;

const summary = {
  totalSamples: readings.length,
  validSamples: validReadings.length,
  averageFps:
    fpsList.length > 0
      ? Math.round((fpsList.reduce((a, b) => a + b, 0) / fpsList.length) * 10) / 10
      : null,
  minFps: fpsList.length > 0 ? Math.min(...fpsList) : null,
  finalElapsedMs: last?.elapsedMs ?? null,
  finalMinActiveBalls: last?.minActiveBalls ?? null,
  finalRecoveredBalls: last?.recoveredBalls ?? null,
  finalOutOfBoundsBalls: last?.outOfBoundsBalls ?? null,
  finalGimmicks: last?.gimmicks ?? null,
  gimmicksAllFiredAtLeastOnce: last?.gimmicks
    ? Object.values(last.gimmicks).every((count) => count >= 1)
    : null,
  consoleErrorCount: consoleErrors.length,
};

console.log(JSON.stringify({ readings, summary, consoleErrors, target: target.id }, null, 2));

await closeTarget(target.id);
ws.close();
process.exit(0);
