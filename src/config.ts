/**
 * 装置を組み立てる論理座標系のサイズ。
 * 画面の大きさによらずこの矩形に装置全体を収め、固定カメラで見せる。
 */
export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;

/**
 * デザイントークン (issue #5 で確定・issue コメントに転記済み。値は変更しないこと)。
 * 子供向け玩具と科学館の展示装置の中間くらいの見た目を狙う。
 */

/** レターボックス（装置の外側）の色。ステージと同系統の落ち着いた青灰にして境界を目立たせない。 */
export const SURROUND_COLOR = "#d7dde1";

/** 装置が置かれる面の色。淡い青灰。背景は明るく保ち、動くものを見やすくする。 */
export const STAGE_COLOR = "#e9eef0";

/** 木部（坂・シーソーの板・台座・ドミノ）の面色。明るいバーチ材。 */
export const BIRCH_COLOR = "#e0b877";

/** 木口・陰・木目の色。 */
export const BIRCH_SHADOW_COLOR = "#b98c4e";

/** 金属部（軸・バネ・発射装置・エレベーターのレール・留め具）の色。 */
export const STEEL_COLOR = "#9aa7ad";

/** 輪郭線の色。黒ではなく青灰寄りの濃色にして硬さを抜く。 */
export const INK_COLOR = "#3b4348";
