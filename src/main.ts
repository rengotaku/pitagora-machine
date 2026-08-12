import "./style.css";
import { startSimulation } from "./machine/simulation";

const canvas = document.querySelector<HTMLCanvasElement>("#stage");
if (!canvas) {
  throw new Error("#stage の canvas が見つかりません");
}

const context = canvas.getContext("2d");
if (!context) {
  throw new Error("2D コンテキストを取得できませんでした");
}

startSimulation(canvas, context);
