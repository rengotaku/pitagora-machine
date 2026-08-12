#!/usr/bin/env node
/**
 * 連続性の検証スクリプト (issue #16 STEP1)。
 *
 * 画面上で描画されるボール軌跡の連続性を計測し、変位の分位数や急変イベント・ワープを検出する。
 *
 * CDP で headless Chrome に接続し、CanvasRenderingContext2D.prototype の arc/save/restore をフックして
 * フレームごとの描画円 (ボール) の座標を記録する。
 *
 * 純粋ロジック関数 (isBall, calculateQuantile, analyzeContinuity) はこのモジュールから export され、
 * vitest (scripts/verify-continuity.test.mjs) により単体テスト可能。
 */

import { fileURLToPath } from "node:url";

/**
 * 円オブジェクトが「ボール」であるかを判定する。
 * - 半径が 14 以上 22 以下の非整数 (浮動小数点数) のみをボールとして扱う。
 * - 整数半径は装置パーツ (ネジやギミック等) のため除外する。
 */
export function isBall(circle) {
  if (!circle || typeof circle.r !== "number" || isNaN(circle.r)) {
    return false;
  }
  const r = circle.r;
  if (r < 14 || r > 22) {
    return false;
  }
  // 浮動小数点の丸め誤差を考慮し、ほぼ整数の場合も除外する
  return !Number.isInteger(r) && Math.abs(r - Math.round(r)) > 1e-4;
}

/**
 * ソート済み数値配列の分位数を計算する (線形補間)。
 * @param {number[]} sortedValues - 昇順ソート済みの数値配列
 * @param {number} q - 0〜1 の分位点 (例: 0.5 = 中央値, 0.9 = 90%)
 */
export function calculateQuantile(sortedValues, q) {
  if (!sortedValues || sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const pos = q * (sortedValues.length - 1);
  const base = Math.floor(pos);
  const rest = pos - base;
  if (base + 1 < sortedValues.length) {
    return sortedValues[base] + rest * (sortedValues[base + 1] - sortedValues[base]);
  }
  return sortedValues[base];
}

/**
 * 収集したフレームデータから連続性指標 (変位・分位数・ワープ・急変) を集計する。
 *
 * @param {Array<{timestamp: number, circles: Array<{x: number, y: number, r: number}>}>} frames
 */
export function analyzeContinuity(frames) {
  if (!frames || frames.length === 0) {
    return {
      totalFrames: 0,
      durationMs: 0,
      averageFps: 0,
      medianFrameIntervalMs: 0,
      displacements: { count: 0, p50: 0, p90: 0, p99: 0, max: 0 },
      overshootEvents: { count: 0, items: [] },
      suddenEvents: { count: 0, ratePerMinute: 0, items: [] },
    };
  }

  const totalFrames = frames.length;
  const firstTime = frames[0].timestamp;
  const lastTime = frames[frames.length - 1].timestamp;
  const durationMs = lastTime - firstTime;
  const durationMinutes = durationMs > 0 ? durationMs / 60000 : 0;
  const averageFps = durationMs > 0 ? Math.round(((totalFrames - 1) / (durationMs / 1000)) * 10) / 10 : 0;

  // フレーム間隔
  const intervals = [];
  for (let i = 1; i < frames.length; i++) {
    intervals.push(frames[i].timestamp - frames[i - 1].timestamp);
  }
  intervals.sort((a, b) => a - b);
  const medianFrameIntervalMs = Math.round(calculateQuantile(intervals, 0.5) * 100) / 100;

  // ボールごとのフレーム位置をまとめる
  /** @type {Map<string, Array<{frameIndex: number, timestamp: number, x: number, y: number, r: number}>>} */
  const ballHistory = new Map();

  frames.forEach((frame, frameIndex) => {
    if (!frame.circles) return;
    frame.circles.forEach((circle) => {
      if (isBall(circle)) {
        const key = circle.r.toFixed(4);
        if (!ballHistory.has(key)) {
          ballHistory.set(key, []);
        }
        ballHistory.get(key).push({
          frameIndex,
          timestamp: frame.timestamp,
          x: circle.x,
          y: circle.y,
          r: circle.r,
        });
      }
    });
  });

  const allDisplacements = [];
  const overshootItems = [];
  const suddenItems = [];

  // 各ボールについて連続検出フレーム間の変位を計算
  ballHistory.forEach((history) => {
    let prevDispRecord = null;

    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1];
      const curr = history[i];

      // フレームが連続しているか (前フレームと1つ差) の場合のみ判定対象とする
      if (curr.frameIndex === prev.frameIndex + 1) {
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const displacement = Math.sqrt(dx * dx + dy * dy);
        allDisplacements.push(displacement);

        const record = {
          ballRadius: curr.r,
          frameIndex: curr.frameIndex,
          timestamp: curr.timestamp,
          displacement: Math.round(displacement * 100) / 100,
          x: Math.round(curr.x * 10) / 10,
          y: Math.round(curr.y * 10) / 10,
          prevX: Math.round(prev.x * 10) / 10,
          prevY: Math.round(prev.y * 10) / 10,
        };

        // 1 フレーム変位がボール直径 (36px) を超えた事象
        if (displacement > 36.0) {
          overshootItems.push(record);
        }

        // 急変イベント判定: 直前フレームの 3 倍超かつ 5px 超
        if (prevDispRecord && prevDispRecord.frameIndex === prev.frameIndex) {
          const prevDisp = prevDispRecord.displacement;
          if (displacement > 5.0 && displacement > 3.0 * prevDisp) {
            suddenItems.push({
              ...record,
              prevDisplacement: prevDisp,
            });
          }
        }

        prevDispRecord = record;
      } else {
        prevDispRecord = null;
      }
    }
  });

  allDisplacements.sort((a, b) => a - b);

  const roundedQuantile = (q) => Math.round(calculateQuantile(allDisplacements, q) * 100) / 100;

  return {
    totalFrames,
    durationMs: Math.round(durationMs),
    averageFps,
    medianFrameIntervalMs,
    displacements: {
      count: allDisplacements.length,
      p50: roundedQuantile(0.5),
      p90: roundedQuantile(0.9),
      p99: roundedQuantile(0.99),
      max: allDisplacements.length > 0 ? Math.round(allDisplacements[allDisplacements.length - 1] * 100) / 100 : 0,
    },
    overshootEvents: {
      count: overshootItems.length,
      items: overshootItems,
    },
    suddenEvents: {
      count: suddenItems.length,
      ratePerMinute: durationMinutes > 0 ? Math.round((suddenItems.length / durationMinutes) * 10) / 10 : 0,
      items: suddenItems,
    },
  };
}

// --- CLI エントリポイント ---
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [, , pageUrl, durationRaw = "10000", outDir, label = "continuity"] = process.argv;

  if (!pageUrl) {
    console.error("使い方: node scripts/verify-continuity.mjs <url> [durationMs] [outDir] [label]");
    process.exit(1);
  }

  const CDP_PORT = process.env.CDP_PORT || "9333";
  const durationMs = Number(durationRaw);

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

  const hookScript = `
    (function() {
      window.__continuityLogs = [];
      let currentFrame = [];
      let depth = 0;
      const origArc = CanvasRenderingContext2D.prototype.arc;
      const origSave = CanvasRenderingContext2D.prototype.save;
      const origRestore = CanvasRenderingContext2D.prototype.restore;

      CanvasRenderingContext2D.prototype.save = function(...args) {
        depth++;
        return origSave.apply(this, args);
      };

      CanvasRenderingContext2D.prototype.restore = function(...args) {
        depth--;
        if (depth === 0) {
          if (currentFrame.length > 0) {
            window.__continuityLogs.push({
              timestamp: performance.now(),
              circles: currentFrame
            });
            currentFrame = [];
          }
        }
        return origRestore.apply(this, args);
      };

      CanvasRenderingContext2D.prototype.arc = function(x, y, r, ...args) {
        if (r >= 8 && r <= 40) {
          currentFrame.push({ x, y, r });
        }
        return origArc.apply(this, [x, y, r, ...args]);
      };
    })();
  `;

  await send("Runtime.evaluate", { expression: hookScript });

  await sleep(durationMs);

  const evaluated = await send("Runtime.evaluate", {
    expression: "JSON.stringify(window.__continuityLogs ?? [])",
    returnByValue: true,
  });

  const rawLogs = evaluated.result?.value ?? "[]";
  const frames = JSON.parse(rawLogs);
  const summary = analyzeContinuity(frames);

  if (outDir) {
    await fs.mkdir(outDir, { recursive: true });
    const file = `${outDir}/${label}-summary.json`;
    await fs.writeFile(file, JSON.stringify({ summary, framesCount: frames.length }, null, 2));
  }

  console.log(JSON.stringify(summary, null, 2));

  await closeTarget(target.id);
  ws.close();
  process.exit(0);
}
