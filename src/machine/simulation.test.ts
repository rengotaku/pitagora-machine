import { describe, expect, it, vi } from "vitest";
import { startSimulation } from "./simulation";

/**
 * jsdom は canvas 2d context を実装しない (node-canvas 未導入) ため、
 * canvas.getContext("2d") は常に null を返す (renderer.test.ts / 既存の
 * simulation.test.ts が `if (!ctx) return;` で早期リターンしているのはこのため)。
 * step()/loop() の呼び出し回数を検証するテストは renderWorld の呼び出しまで実際に
 * 完走させる必要があるため、renderer.ts が呼ぶ最小限の Canvas 2D API をモックする。
 */
function createMockCtx2D(): CanvasRenderingContext2D {
  const noop = (): void => {};
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    fillRect: noop,
    strokeRect: noop,
    save: noop,
    restore: noop,
    translate: noop,
    scale: noop,
    setTransform: noop,
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    arc: noop,
    fill: noop,
    stroke: noop,
    rotate: noop,
    quadraticCurveTo: noop,
  } as unknown as CanvasRenderingContext2D;
}

describe("simulation", () => {
  it("startSimulation でシミュレーションが起動し、stop() で停止する", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const sim = startSimulation(canvas, ctx, { seed: 100 });
    expect(sim).toBeDefined();
    expect(typeof sim.stop).toBe("function");

    expect(window.__pitagora).toBeDefined();
    expect(typeof window.__pitagora?.activeBalls).toBe("number");
    expect(typeof window.__pitagora?.minActiveBalls).toBe("number");

    sim.stop();
  });

  it("step() を複数回呼んでも requestAnimationFrame の予約回数が増えない (レビュー指摘 #2 回帰テスト)", () => {
    // step() が内部で loop() を呼ぶ実装だと、呼ぶたびに新しい RAF が予約され、
    // 既存の自動ループと並行して物理・投入が多重に進行してしまう。
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = createMockCtx2D();

    const rafSpy = vi.spyOn(window, "requestAnimationFrame");

    const sim = startSimulation(canvas, ctx, { seed: 300 });
    // 起動時の自動ループ予約 (1 回) が済んだ時点での呼び出し回数を基準にする
    const callsAfterStart = rafSpy.mock.calls.length;
    expect(callsAfterStart).toBeGreaterThan(0);

    sim.step?.(16.666);
    sim.step?.(16.666);
    sim.step?.(16.666);

    expect(rafSpy.mock.calls.length).toBe(callsAfterStart);

    sim.stop();
    rafSpy.mockRestore();
  });
});
