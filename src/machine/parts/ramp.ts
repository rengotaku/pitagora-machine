import Matter from "matter-js";

export interface RampOptions {
  x: number;
  y: number;
  length: number;
  thickness?: number;
  angle: number;
  friction?: number;
  color?: string;
  hasGuard?: boolean;
  guardHeight?: number;
  label?: string;
}

export interface RampComponent {
  bodies: Matter.Body[];
  sensor: Matter.Body;
}

/**
 * 重力で転がる坂を生成する。
 * オプションで低いガイド縁および通過検知センサーを配置可能。
 */
export function createRamp(options: RampOptions): RampComponent {
  const thickness = options.thickness ?? 16;
  const label = options.label ?? "ramp";
  const friction = options.friction ?? 0.002;
  const color = options.color ?? "#4a3b32";

  // 坂の床
  const ramp = Matter.Bodies.rectangle(options.x, options.y, options.length, thickness, {
    isStatic: true,
    angle: options.angle,
    friction,
    restitution: 0.1,
    label,
    plugin: { color },
  });

  const bodies: Matter.Body[] = [ramp];

  // 低いガイド縁
  if (options.hasGuard) {
    const guardHeight = options.guardHeight ?? 10;
    const offsetOffsetY = thickness / 2 + guardHeight / 2;
    const guardX = options.x + Math.sin(options.angle) * offsetOffsetY;
    const guardY = options.y + Math.cos(options.angle) * offsetOffsetY;

    const guard = Matter.Bodies.rectangle(guardX, guardY, options.length, guardHeight, {
      isStatic: true,
      angle: options.angle,
      label: "guard",
      plugin: { color: "rgba(120, 100, 80, 0.4)" },
    });
    bodies.push(guard);
  }

  // 通過検知センサー
  const sensor = Matter.Bodies.rectangle(
    options.x,
    options.y - 10,
    options.length * 0.8,
    40,
    {
      isStatic: true,
      isSensor: true,
      angle: options.angle,
      label: `${label}_sensor`,
      plugin: { color: "transparent" },
    }
  );
  bodies.push(sensor);

  return { bodies, sensor };
}
