import { describe, expect, it } from "vitest";
import { runFixedSteps } from "./frame-scheduler";

describe("frame-scheduler (レビュー指摘 #1 回帰テスト: 低FPS 時の装置更新取りこぼし)", () => {
  it("steps=3 を渡すと、onPhysicsStep と onDeviceStep がそれぞれ 3 回ずつ fixedDeltaMs を伴って呼ばれる", () => {
    const physicsCalls: number[] = [];
    const deviceCalls: number[] = [];

    runFixedSteps(3, 16.666, {
      onPhysicsStep: (dt) => physicsCalls.push(dt),
      onDeviceStep: (dt) => deviceCalls.push(dt),
    });

    expect(physicsCalls).toEqual([16.666, 16.666, 16.666]);
    expect(deviceCalls).toEqual([16.666, 16.666, 16.666]);
  });

  it("steps=0 では onPhysicsStep も onDeviceStep も呼ばれない (端数のみのフレーム)", () => {
    let physicsCount = 0;
    let deviceCount = 0;

    runFixedSteps(0, 16.666, {
      onPhysicsStep: () => (physicsCount += 1),
      onDeviceStep: () => (deviceCount += 1),
    });

    expect(physicsCount).toBe(0);
    expect(deviceCount).toBe(0);
  });

  it("各ステップ内では onPhysicsStep の直後に onDeviceStep が呼ばれる (装置更新が物理更新に対して同じ粒度で同期する)", () => {
    const order: string[] = [];

    runFixedSteps(2, 16.666, {
      onPhysicsStep: () => order.push("physics"),
      onDeviceStep: () => order.push("device"),
    });

    expect(order).toEqual(["physics", "device", "physics", "device"]);
  });

  it("低FPS を模した steps=5 (maxStepsPerFrame 打ち切り相当) でも、装置更新の回数は steps と一致する", () => {
    let deviceCount = 0;
    runFixedSteps(5, 16.666, {
      onPhysicsStep: () => {},
      onDeviceStep: () => (deviceCount += 1),
    });
    expect(deviceCount).toBe(5);
  });
});
