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
    // issue #6: debugEnabled=true 時に renderer.ts の drawDebugSensor が呼ぶ。
    setLineDash: noop,
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

  it("issue #6: setGravity で engine.gravity.y を稼働中のまま書き換えられる (再構築なし)", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = createMockCtx2D();

    const sim = startSimulation(canvas, ctx, { seed: 400 });
    expect(() => sim.setGravity(0)).not.toThrow();
    expect(() => sim.step?.(16.666)).not.toThrow();
    // 重力を 0 にしても装置がクラッシュしない (座標が NaN 化しない) ことを確認する。
    expect(Number.isFinite(window.__pitagora?.activeBalls)).toBe(true);

    expect(() => sim.setGravity(1)).not.toThrow();
    expect(() => sim.step?.(16.666)).not.toThrow();

    sim.stop();
  });

  it("issue #6: setMaxActiveBalls で上限を下げると超過分の既存ボールが回収される", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = createMockCtx2D();

    // 投入間隔を 0 にして、短い step 回数でも複数ボールが同時稼働する状態を作る。
    const sim = startSimulation(canvas, ctx, {
      seed: 500,
      maxActiveBalls: 5,
      minSpawnDelayMs: 0,
      maxSpawnDelayMs: 0,
    });
    for (let i = 0; i < 10; i += 1) {
      sim.step?.(16.666);
    }
    expect(window.__pitagora?.activeBalls).toBeGreaterThan(1);

    sim.setMaxActiveBalls(1);
    sim.step?.(16.666);
    expect(window.__pitagora?.activeBalls).toBeLessThanOrEqual(1);

    sim.stop();
  });

  it("issue #6: setSpeedScale を変更してもエラーなく稼働し続ける", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = createMockCtx2D();

    const sim = startSimulation(canvas, ctx, { seed: 600 });
    sim.setSpeedScale(2);
    expect(() => sim.step?.(16.666)).not.toThrow();
    sim.setSpeedScale(0.25);
    expect(() => sim.step?.(16.666)).not.toThrow();

    sim.stop();
  });

  it("issue #6: setDebugEnabled(true) で当たり判定描画が有効になってもエラーなく稼働する", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = createMockCtx2D();

    const sim = startSimulation(canvas, ctx, { seed: 700 });
    sim.setDebugEnabled(true);
    expect(() => sim.step?.(16.666)).not.toThrow();

    sim.stop();
  });

  it("issue #6: reset() で統計がゼロに戻り、装置がページリロードなしに再稼働する", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = createMockCtx2D();

    const sim = startSimulation(canvas, ctx, { seed: 800 });
    sim.step?.(16.666);
    sim.step?.(16.666);

    sim.reset();

    expect(window.__pitagora?.elapsedMs).toBe(0);
    expect(window.__pitagora?.recoveredBalls).toBe(0);
    expect(window.__pitagora?.outOfBoundsBalls).toBe(0);
    expect(window.__pitagora?.activeBalls).toBe(1);
    expect(window.__pitagora?.gimmicks.ramp1).toBe(0);

    sim.stop();
  });

  it("issue #6: 仕掛けが実際に作動した状態から reset() すると、仕掛けごとの作動回数もゼロに戻る (レビュー指摘 #2 回帰テスト)", () => {
    // レビュー指摘: 装置がしばらく稼働してドミノ・シーソー・振り子・エレベーターが
    // 動いた後に reset() すると、ボールと統計しか初期化されず、各 Matter body の
    // 位置・角度・速度や仕掛け内部の保持状態が残ったままになっていた。
    // ここでは「仕掛けが実際に 1 回以上作動した状態」を作ってから reset() し、
    // gimmicks の全カウントがゼロに戻ることを回帰確認する (各仕掛けの body の
    // 位置・角度が生成時の姿勢に戻ることは src/machine/parts/*.test.ts の
    // 個別テストで検証済み)。
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = createMockCtx2D();

    const sim = startSimulation(canvas, ctx, {
      seed: 900,
      maxActiveBalls: 5,
      minSpawnDelayMs: 500,
      maxSpawnDelayMs: 800,
    });

    for (let i = 0; i < 2000; i += 1) {
      sim.step?.(16.666);
    }

    const beforeReset = window.__pitagora?.gimmicks;
    expect(beforeReset).toBeDefined();
    const totalFiredBeforeReset = Object.values(beforeReset ?? {}).reduce(
      (sum, count) => sum + count,
      0
    );
    // 少なくともいずれかの仕掛けが実際に作動していること (前提の成立確認)
    expect(totalFiredBeforeReset).toBeGreaterThan(0);

    expect(() => sim.reset()).not.toThrow();

    expect(window.__pitagora?.elapsedMs).toBe(0);
    expect(window.__pitagora?.recoveredBalls).toBe(0);
    expect(window.__pitagora?.outOfBoundsBalls).toBe(0);

    const afterReset = window.__pitagora?.gimmicks;
    expect(afterReset).toBeDefined();
    for (const [name, count] of Object.entries(afterReset ?? {})) {
      expect(count, `gimmicks.${name} が reset 後もゼロに戻っていない`).toBe(0);
    }

    // reset 後も装置がクラッシュせずに稼働し続けられること
    expect(() => sim.step?.(16.666)).not.toThrow();

    sim.stop();
  });
});
