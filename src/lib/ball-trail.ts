export interface Point {
  x: number;
  y: number;
}

export interface BallTrailTrackerOptions {
  /** 保持する最大点数 (省略時は 90 点: 60fps で 1.5 秒分) */
  maxPoints?: number;
}

export interface BallTrailTracker {
  addPoint(ballId: number, position: Point): void;
  forget(ballId: number): void;
  clear(): void;
  getTrail(ballId: number): Point[];
  getAllTrails(): Map<number, Point[]>;
}

export function createBallTrailTracker(
  options: BallTrailTrackerOptions = {}
): BallTrailTracker {
  const maxPoints = options.maxPoints ?? 90;
  const trails = new Map<number, Point[]>();

  return {
    addPoint(ballId: number, position: Point): void {
      let list = trails.get(ballId);
      if (!list) {
        list = [];
        trails.set(ballId, list);
      }
      list.push({ x: position.x, y: position.y });
      if (list.length > maxPoints) {
        list.shift();
      }
    },

    forget(ballId: number): void {
      trails.delete(ballId);
    },

    clear(): void {
      trails.clear();
    },

    getTrail(ballId: number): Point[] {
      return trails.get(ballId) ?? [];
    },

    getAllTrails(): Map<number, Point[]> {
      return trails;
    },
  };
}
