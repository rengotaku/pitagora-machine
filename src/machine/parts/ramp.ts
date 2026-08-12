import Matter from "matter-js";

export interface RampOptions {
  x: number;
  y: number;
  length: number;
  thickness?: number;
  angle: number;
  friction?: number;
  color?: string;
}

/**
 * 重力で転がる坂を生成する。
 * 角度・長さ・位置を引数で受け、複数配置できる形にする。
 */
export function createRamp(options: RampOptions): Matter.Body {
  const thickness = options.thickness ?? 20;
  const ramp = Matter.Bodies.rectangle(options.x, options.y, options.length, thickness, {
    isStatic: true,
    angle: options.angle,
    friction: options.friction ?? 0.1,
    restitution: 0.2,
    label: "ramp",
    plugin: {
      color: options.color ?? "#4a3b32",
    },
  });
  return ramp;
}
