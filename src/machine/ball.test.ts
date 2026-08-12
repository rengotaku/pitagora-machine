import { describe, expect, it } from "vitest";
import { createRng } from "../lib/random";
import { createBall, getBallData, resetBallIdCounter } from "./ball";

describe("ball", () => {
  it("createBall で一意な id とサイズ・色のついたボール Body が生成される", () => {
    resetBallIdCounter();
    const rng = createRng(42);

    const ball1 = createBall(rng, 100, 200);
    const data1 = getBallData(ball1);

    expect(data1).toBeDefined();
    expect(data1?.id).toBe(1);
    expect(data1?.radius).toBeGreaterThan(0);
    expect(typeof data1?.color).toBe("string");

    const ball2 = createBall(rng, 150, 200);
    const data2 = getBallData(ball2);

    expect(data2?.id).toBe(2);
    expect(data2?.id).not.toBe(data1?.id);
  });
});
