import Matter from "matter-js";
import { BIRCH_COLOR, STEEL_COLOR } from "../../config";
import { setBodyAngle, setBodyPosition } from "../kinematic";

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
  /**
   * 運搬待ちのボールかどうか（キャリア上・待機床・ホッパー）。
   * 呼び出し側はこれを見て停滞検知（回収）の対象から外す。
   */
  isHolding(ballId: number): boolean;
  /**
   * キャリアに載っている（または待機床にある）ボールかどうか。
   * こちらは押し出し (nudge) の除外にだけ使う。
   *
   * ホッパーで順番待ちしているボールは isHolding では true になるが、
   * ここでは false を返す。ホッパー上で固着したボールにも押し出しを効かせないと、
   * 待機列が流れずエレベーターの周回が落ちるため（実測で周回が 25 → 7 になった）。
   */
  isCarried(ballId: number): boolean;
  reset(): void;
}

/**
 * まとめ積みの待ち時間 (ms)。最初のボールが受け皿に入ってからこの時間だけ
 * ゲートを開けたまま待ち、後続も積んでから発車する。1 個ずつ運ぶと 1 周に
 * 1 個しか運べず、後続がホッパーに溜まって装置全体の流量が落ちる。
 */
const LOAD_DWELL_MS = 450;

/** 受け皿に同時に積む上限。これに達したら待ち時間を待たずに発車する。 */
const LOAD_CAPACITY = 3;

/**
 * 坂2の左端 (x=464, y=694) から落ちてきたボールをホッパー (溜め) で受け、
 * ゲートと出口シュートを通じてキャリア受け皿へ導き、
 * 最上部 (topY) まで持ち上げて放出するエレベーター。
 */
export function createElevator(options: ElevatorOptions = {}): ElevatorComponent {
  const x = options.x ?? 300;
  const bottomY = options.bottomY ?? 740;
  const topY = options.topY ?? 120;
  const speed = options.speed ?? 300;
  const color = options.color ?? BIRCH_COLOR;

  let currentY = bottomY;
  let state: "waiting_bottom" | "moving_up" | "dispensing" | "moving_down" =
    "waiting_bottom";
  let stateTimer = 0;
  /** 最初のボールが受け皿に入ってからの経過時間。まとめ積みの待ち時間に使う。 */
  let loadTimer = 0;

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

  // 右壁を低く設定 (高さ 44, 上端 currentY - 10 → 停車時 y 730)
  const carrierRightWall = Matter.Bodies.rectangle(x + 75, currentY + 12, 14, 44, {
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

  // ホッパー床。キャリアの掃引範囲 (x-77..x+82) の外に置く。
  // 座標は x / bottomY からの相対で決める（固定値にすると、既定以外の配置を
  // 渡したときにキャリアだけが移動してホッパーが取り残される）。
  const hopperCenterX = x + 155;
  const hopperCenterY = bottomY - 34;
  const gatePivotX = x + 93;
  const gatePivotY = bottomY - 87;
  const gateHalfLen = 26;
  const hopperFloor = Matter.Bodies.rectangle(hopperCenterX, hopperCenterY, 120, 12, {
    isStatic: true,
    angle: -0.2,
    friction: 0.05,
    label: "elevator_hopper_floor",
    plugin: { color, material: "wood", moving: false },
  });

  // ゲート（支点は gatePivotX / gatePivotY、長さ 52、厚み 8）
  const gate = Matter.Bodies.rectangle(gatePivotX, gatePivotY + gateHalfLen, 8, 52, {
    isStatic: true,
    label: "elevator_gate",
    plugin: { color: STEEL_COLOR, material: "metal", moving: true },
  });

  // 出口シュート。ホッパーから受け皿へ導く。右壁の上端より上を通る高さに置く。
  const exitChute = Matter.Bodies.rectangle(x + 71.5, bottomY - 20, 56, 12, {
    isStatic: true,
    angle: -0.28,
    label: "elevator_exit_chute",
    plugin: { color, material: "wood", moving: false },
  });

  const bodies = [
    rail,
    carrierBase,
    carrierLeftWall,
    carrierRightWall,
    waitingFloor,
    sensor,
    hopperFloor,
    gate,
    exitChute,
  ];

  const updatePositions = (newY: number): void => {
    currentY = newY;
    setBodyPosition(carrierBase, { x, y: currentY + 24 }, true);
    setBodyPosition(carrierLeftWall, { x: x - 70, y: currentY - 8 }, true);
    setBodyPosition(carrierRightWall, { x: x + 75, y: currentY + 12 }, true);
  };

  const updateGate = (isOpen: boolean): void => {
    const angle = isOpen ? -1.5708 : 0;
    const pivotX = gatePivotX;
    const pivotY = gatePivotY;
    const halfLen = gateHalfLen;
    const cx = pivotX + halfLen * Math.sin(angle);
    const cy = pivotY + halfLen * Math.cos(angle);
    setBodyPosition(gate, { x: cx, y: cy }, true);
    setBodyAngle(gate, angle, true);
  };

  const dispensedBalls = new Set<number>();
  const heldBallIds = new Set<number>();
  /** キャリア上・待機床のボール。ホッパーで順番待ちしているものは含めない。 */
  const carriedBallIds = new Set<number>();

  return {
    bodies,
    sensor,
    isHolding(ballId: number): boolean {
      return heldBallIds.has(ballId);
    },
    isCarried(ballId: number): boolean {
      return carriedBallIds.has(ballId);
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
      carriedBallIds.clear();
      const idOf = (b: Matter.Body): number | undefined =>
        (b.plugin as { ballData?: { id: number } })?.ballData?.id;
      const rememberHeld = (b: Matter.Body, carried: boolean): void => {
        const id = idOf(b);
        if (id === undefined) return;
        heldBallIds.add(id);
        if (carried) {
          carriedBallIds.add(id);
        }
      };
      for (const b of ballsInCarrier) {
        rememberHeld(b, true);
      }
      const waitingFloorTop = waitingFloor.position.y - 8;
      for (const b of balls) {
        const onWaitingFloor =
          Math.abs(b.position.x - x) < 80 &&
          b.position.y >= waitingFloorTop - 60 &&
          b.position.y <= waitingFloorTop + 12;
        // ホッパーで順番待ちしているボールは「回収されては困る」が「押し出しは要る」。
        // 固着したまま押し出しも効かないと待機列が流れず、エレベーターの周回が落ちる。
        const onHopper =
          b.position.x >= x + 80 &&
          b.position.x <= x + 225 &&
          b.position.y >= bottomY - 100 &&
          b.position.y <= bottomY - 5;
        if (onWaitingFloor) {
          rememberHeld(b, true);
        } else if (onHopper) {
          rememberHeld(b, false);
        }
      }

      switch (state) {
        case "waiting_bottom": {
          updatePositions(bottomY);
          updateGate(true);

          const readyBallsInCarrier = balls.filter(
            (b) =>
              Math.abs(b.position.x - x) < 65 &&
              b.position.y >= currentY - 40 &&
              b.position.y <= currentY + 30
          );

          // 1 個目が入った時点で発車すると 1 周につき 1 個しか運べず、後続がホッパーに
          // 溜まり続けて装置全体の流量が落ちる (実測: elevator 25 → 6 / seesaw 33 → 11)。
          // 最初の 1 個が入ってから短い間ゲートを開けたまま待ち、複数個をまとめて積む。
          if (readyBallsInCarrier.length > 0) {
            loadTimer += deltaMs;
          } else {
            loadTimer = 0;
          }

          // 受け皿の容量に達したら待たずに発車する。
          if (
            readyBallsInCarrier.length >= LOAD_CAPACITY ||
            (readyBallsInCarrier.length > 0 && loadTimer >= LOAD_DWELL_MS)
          ) {
            state = "moving_up";
            loadTimer = 0;
            updateGate(false);
          }
          break;
        }
        case "moving_up": {
          updateGate(false);

          const nextY = Math.max(topY, currentY - speed * deltaSec);
          updatePositions(nextY);

          for (const ball of ballsInCarrier) {
            Matter.Body.setVelocity(ball, { x: 0, y: -speed / 60 });
          }

          if (currentY <= topY) {
            state = "dispensing";
            stateTimer = 0;
          }
          break;
        }
        case "dispensing": {
          updateGate(false);
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
          updateGate(false);
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
      state = "waiting_bottom";
      stateTimer = 0;
      loadTimer = 0;
      dispensedBalls.clear();
      heldBallIds.clear();
      updatePositions(bottomY);
      updateGate(false);
    },
  };
}
