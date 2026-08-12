import { describe, expect, it } from "vitest";
import { createLauncher } from "./launcher";

describe("launcher", () => {
  it("createLauncher で右上発射装置が生成される", () => {
    const launcher = createLauncher({
      x: 1150,
      y: 470,
      launchVx: 12.5,
      launchVy: -16.5,
    });
    expect(launcher.bodies.length).toBeGreaterThanOrEqual(2);
    expect(launcher.sensor).toBeDefined();
    expect(typeof launcher.update).toBe("function");
  });
});
