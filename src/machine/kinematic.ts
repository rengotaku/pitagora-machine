import Matter from "matter-js";

/**
 * @types/matter-js の型定義は Matter.Body.setAngle / setPosition を
 * (body, value) の 2 引数までしか宣言していないが、実行時の Matter.js 本体
 * (matter-js/src/body/Body.js) は 3 引数目 updateVelocity を受け付ける。
 * true を渡すと position/angle の変化量から velocity/angularVelocity を
 * 逆算して設定するため、isStatic なボディを毎ステップ書き換えて
 * キネマティックに駆動する際 (回転ホイール・振り子) に、衝突解決が
 * 正しい相対速度を読み取れるようにする。ここではその型ギャップだけを
 * 埋める薄いラッパーを提供する。
 */
type SetAngleFn = (body: Matter.Body, angle: number, updateVelocity?: boolean) => void;
type SetPositionFn = (
  body: Matter.Body,
  position: Matter.Vector,
  updateVelocity?: boolean
) => void;

const setAngleImpl = Matter.Body.setAngle as unknown as SetAngleFn;
const setPositionImpl = Matter.Body.setPosition as unknown as SetPositionFn;

export function setBodyAngle(
  body: Matter.Body,
  angle: number,
  updateVelocity = false
): void {
  setAngleImpl(body, angle, updateVelocity);
}

export function setBodyPosition(
  body: Matter.Body,
  position: Matter.Vector,
  updateVelocity = false
): void {
  setPositionImpl(body, position, updateVelocity);
}
