import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      // 分岐を持つ純粋ロジックだけを対象にする。装置の組み立て (src/machine) と
      // 描画 (src/render) は Matter.js / Canvas の実挙動でしか壊れ方が出ず、
      // 単体テストでは検知できない。そちらは長時間稼働の実測とスクリーンショットで担保する。
      include: ["src/lib/**/*.ts"],
      exclude: ["**/*.test.ts"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
});
