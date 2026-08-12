/**
 * 固定タイムステップの物理更新と、それに同期させる装置更新をまとめて実行するランナー。
 */

export interface FixedStepCallbacks {
  /** 固定ステップ 1 回分の物理更新 (Matter.Engine.update を想定)。 */
  onPhysicsStep(fixedDeltaMs: number): void;
  /**
   * 固定ステップ 1 回分の装置更新。launcher のセンサー通過判定・elevator の
   * キャリア駆動と受け渡しなど、ボディの位置に依存する検知・駆動を渡す。
   */
  onDeviceStep(fixedDeltaMs: number): void;
}

/**
 * steps 回、fixedDeltaMs 刻みで物理更新 (onPhysicsStep) と装置更新 (onDeviceStep) を
 * 同じステップ内で実行する。
 *
 * 装置更新をこのループの外に出し 1 フレームにつき 1 回だけ実行すると、低 FPS やタブ
 * 復帰などで steps が複数になったとき、物理だけがまとめて進んだ後に装置状態が 1 回しか
 * 評価されない。結果、launcher のセンサーをボールが検知されずに通過したり、elevator が
 * 複数ステップ分の駆動時間を一度に処理してボールを取りこぼしたりし、装置の循環が
 * 止まりうる (レビュー指摘 #1)。このランナーは物理と装置を同じ粒度で進めることで
 * その取りこぼしを防ぐ。
 */
export function runFixedSteps(
  steps: number,
  fixedDeltaMs: number,
  callbacks: FixedStepCallbacks
): void {
  for (let i = 0; i < steps; i += 1) {
    callbacks.onPhysicsStep(fixedDeltaMs);
    callbacks.onDeviceStep(fixedDeltaMs);
  }
}
