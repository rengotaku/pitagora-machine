import Matter from "matter-js";
import { BIRCH_COLOR, STEEL_COLOR } from "../../config";
import { setBodyPosition } from "../kinematic";

export interface ElevatorOptions {
  x?: number;
  bottomY?: number;
  topY?: number;
  speed?: number;
  color?: string;
}

export interface ElevatorComponent {
  bodies: Matter.Body[];
  sensor: Matter.Body;
  update(
    engine: Matter.Engine,
    deltaMs: number,
    onDispense?: (ballId: number) => void
  ): void;
  isHolding(ballId: number): boolean;
  reset(): void;
}

interface AligningState {
  alignSteps: number;
  originalMask: number;
}

/**
 * 坂2の左端 (x=470, y=700) から落ちてきたボールを受け止め、
 * 最上部 (300, 130) まで持ち上げて坂1投入口へ放出するエレベーター。
 */
export function createElevator(options: ElevatorOptions = {}): ElevatorComponent {
  const x = options.x ?? 300;
  const bottomY = options.bottomY ?? 760;
  const topY = options.topY ?? 130;
  const speed = options.speed ?? 300;
  const color = options.color ?? BIRCH_COLOR;

  let currentY = bottomY;
  let state: "waiting_bottom" | "moving_up" | "dispensing" | "moving_down" =
    "waiting_bottom";
  let stateTimer = 0;

  const carrierBase = Matter.Bodies.rectangle(x, currentY + 24, 150, 40, {
    isStatic: true,
    label: "elevator_carrier",
    plugin: { color, material: "wood", moving: true },
  });

  const carrierLeftWall = Matter.Bodies.rectangle(x - 70, currentY - 8, 14, 60, {
    isStatic: true,
    label: "elevator_carrier",
    plugin: { color, material: "wood", moving: true },
  });

  const carrierRightWall = Matter.Bodies.rectangle(x + 75, currentY - 6, 14, 70, {
    isStatic: true,
    label: "elevator_carrier",
    plugin: { color, material: "wood", moving: true },
  });

  const waitingFloor = Matter.Bodies.rectangle(x, bottomY + 72, 150, 16, {
    isStatic: true,
    label: "elevator_carrier",
    plugin: { color, material: "wood", moving: false },
  });

  const rail = Matter.Bodies.rectangle(
    x - 85,
    (bottomY + topY) / 2,
    10,
    bottomY - topY + 90,
    {
      isStatic: true,
      label: "elevator_rail",
      plugin: { color: STEEL_COLOR, material: "metal", moving: false },
    }
  );

  const sensor = Matter.Bodies.rectangle(x + 30, topY, 60, 40, {
    isStatic: true,
    isSensor: true,
    label: "elevator_sensor",
    plugin: { color: "transparent" },
  });

  const bodies = [
    rail,
    carrierBase,
    carrierLeftWall,
    carrierRightWall,
    waitingFloor,
    sensor,
  ];

  const updatePositions = (newY: number): void => {
    currentY = newY;
    setBodyPosition(carrierBase, { x, y: currentY + 24 }, true);
    setBodyPosition(carrierLeftWall, { x: x - 70, y: currentY - 8 }, true);
    setBodyPosition(carrierRightWall, { x: x + 75, y: currentY - 6 }, true);
  };

  const dispensedBalls = new Set<number>();
  const heldBallIds = new Set<number>();
  const aligningBalls = new Map<number, AligningState>();

  const restoreMask = (ball: Matter.Body, alignState: AligningState): void => {
    if (ball.collisionFilter && ball.collisionFilter.mask === 0) {
      ball.collisionFilter.mask = alignState.originalMask;
    }
  };

  return {
    bodies,
    sensor,
    isHolding(ballId: number): boolean {
      return heldBallIds.has(ballId);
    },
    update(
      engine: Matter.Engine,
      deltaMs: number,
      onDispense?: (ballId: number) => void
    ): void {
      const deltaSec = deltaMs / 1000;
      const allBodies = Matter.Composite.allBodies(engine.world);
      const balls = allBodies.filter((b) => b.label === "ball");

      const carrierRangeBottom =
        state === "waiting_bottom" ? currentY + 90 : currentY + 44;
      const ballsInCarrier = balls.filter((b) => {
        return (
          Math.abs(b.position.x - x) < 80 &&
          b.position.y >= currentY - 45 &&
          b.position.y <= carrierRangeBottom
        );
      });

      heldBallIds.clear();
      const rememberHeld = (b: Matter.Body): void => {
        const id = (b.plugin as { ballData?: { id: number } })?.ballData?.id;
        if (id !== undefined) {
          heldBallIds.add(id);
        }
      };
      for (const b of ballsInCarrier) {
        rememberHeld(b);
      }
      const waitingFloorTop = waitingFloor.position.y - 8;
      for (const b of balls) {
        const onWaitingFloor =
          Math.abs(b.position.x - x) < 80 &&
          b.position.y >= waitingFloorTop - 60 &&
          b.position.y <= waitingFloorTop + 12;
        if (onWaitingFloor) {
          rememberHeld(b);
        }
      }

      switch (state) {
        case "waiting_bottom": {
          updatePositions(bottomY);

          const seenAligningIds = new Set<number>();

          for (const ball of balls) {
            const ballId = (ball.plugin as { ballData?: { id: number } })?.ballData?.id;
            if (!ballId) continue;

            const onWaitingFloorOrCarrier =
              Math.abs(ball.position.x - x) < 80 &&
              ball.position.y >= currentY - 45 &&
              ball.position.y <= currentY + 90;

            if (onWaitingFloorOrCarrier) {
              const targetY = currentY + 10;
              if (ball.position.y > targetY) {
                seenAligningIds.add(ballId);
                if (!aligningBalls.has(ballId)) {
                  const origMask = ball.collisionFilter?.mask ?? 0xffffffff;
                  aligningBalls.set(ballId, { alignSteps: 0, originalMask: origMask });
                }

                const alignState = aligningBalls.get(ballId)!;
                alignState.alignSteps += 1;

                if (ball.collisionFilter) {
                  ball.collisionFilter.mask = 0;
                }

                const dist = ball.position.y - targetY;
                const maxStepDist = Math.min(alignState.alignSteps, 4);

                if (dist <= maxStepDist || alignState.alignSteps >= 40) {
                  restoreMask(ball, alignState);
                  Matter.Body.setPosition(ball, { x: ball.position.x, y: targetY });
                  Matter.Body.setVelocity(ball, { x: 0, y: 0 });
                  aligningBalls.delete(ballId);
                } else {
                  Matter.Body.setPosition(ball, {
                    x: ball.position.x,
                    y: ball.position.y - maxStepDist,
                  });
                  Matter.Body.setVelocity(ball, { x: 0, y: 0 });
                }
              } else if (aligningBalls.has(ballId)) {
                const alignState = aligningBalls.get(ballId)!;
                restoreMask(ball, alignState);
                aligningBalls.delete(ballId);
              }
            }
          }

          for (const [id, alignState] of aligningBalls.entries()) {
            if (!seenAligningIds.has(id)) {
              const b = balls.find(
                (ball) =>
                  (ball.plugin as { ballData?: { id: number } })?.ballData?.id === id
              );
              if (b) {
                restoreMask(b, alignState);
              }
              aligningBalls.delete(id);
            }
          }

          // キャリア底板の上 (y <= currentY + 15) に整列引き込みが完了したボールがある場合にのみ発車
          const readyBallsInCarrier = balls.filter((b) => {
            const id = (b.plugin as { ballData?: { id: number } })?.ballData?.id;
            return (
              Math.abs(b.position.x - x) < 80 &&
              b.position.y >= currentY - 45 &&
              b.position.y <= currentY + 10 &&
              (!id || !aligningBalls.has(id))
            );
          });

          if (readyBallsInCarrier.length > 0) {
            state = "moving_up";
          }
          break;
        }
        case "moving_up": {
          const nextY = Math.max(topY, currentY - speed * deltaSec);
          updatePositions(nextY);

          for (const ball of ballsInCarrier) {
            Matter.Body.setVelocity(ball, { x: 0, y: -speed / 60 });
            // キャリア上昇中のボール位置をキネマティック追従させてテスト単体でも確実に保持
            Matter.Body.setPosition(ball, {
              x: ball.position.x,
              y: Math.min(ball.position.y, currentY + 10),
            });
          }

          if (currentY <= topY) {
            state = "dispensing";
            stateTimer = 0;
          }
          break;
        }
        case "dispensing": {
          stateTimer += deltaMs;
          updatePositions(topY);

          for (const ball of ballsInCarrier) {
            const currentVx = ball.velocity.x;
            const nextVx = Math.min(8.0, currentVx + 2.0);
            Matter.Body.setVelocity(ball, { x: nextVx, y: -2 });

            const ballId = (ball.plugin as { ballData?: { id: number } })?.ballData?.id;
            if (ballId && !dispensedBalls.has(ballId)) {
              dispensedBalls.add(ballId);
              onDispense?.(ballId);
            }
          }

          if (stateTimer > 450 || ballsInCarrier.length === 0) {
            state = "moving_down";
          }
          break;
        }
        case "moving_down": {
          const nextY = Math.min(bottomY, currentY + speed * deltaSec);
          updatePositions(nextY);

          if (currentY >= bottomY) {
            state = "waiting_bottom";
            dispensedBalls.clear();
          }
          break;
        }
      }
    },
    reset(): void {
      aligningBalls.clear();
      state = "waiting_bottom";
      stateTimer = 0;
      dispensedBalls.clear();
      heldBallIds.clear();
      updatePositions(bottomY);
    },
  };
}
