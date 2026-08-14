import { defineConfig } from "vite";
import path from "path";

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages はプロジェクトページとして https://<owner>.github.io/pitagora-machine/
  // 配下に配信されるため、build 時のみアセット参照パスをリポジトリ名のサブパスに合わせる。
  // dev server (`make run` / `vite`) は従来どおり `/` のまま動かす
  // (検証スクリプト verify-stability.mjs 等が http://localhost:<port>/ を直接叩く前提のため)。
  base: command === "build" ? "/pitagora-machine/" : "/",
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
}));
