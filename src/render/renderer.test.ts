import { describe, expect, it } from "vitest";
import { renderWorld } from "./renderer";
import { createPitagoraWorld } from "../machine/world";
import { fitWorldToCanvas } from "../lib/viewport";
import { WORLD_HEIGHT, WORLD_WIDTH } from "../config";

describe("renderer", () => {
  it("renderWorld がエラーなく呼び出せる", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 900;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { engine } = createPitagoraWorld();
    const transform = fitWorldToCanvas(WORLD_WIDTH, WORLD_HEIGHT, 1600, 900);

    expect(() => {
      renderWorld(ctx, engine, transform, 1600, 900);
    }).not.toThrow();
  });
});
