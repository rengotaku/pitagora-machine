import { describe, expect, it } from "vitest";
import { startSimulation } from "./simulation";

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
});
