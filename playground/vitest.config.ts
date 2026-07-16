import { defineConfig } from "vitest/config";

export default defineConfig({
  // vite.config.ts と同じ __APP_VERSION__ を定義。テスト実行時は git 情報と
  // 無関係な固定値でよいため、実際の SHA 解決ロジック (git 未使用時 "dev" に
  // フォールバックする分岐) には依存しない。
  define: {
    __APP_VERSION__: JSON.stringify("test"),
  },
  test: {
    include: ["test/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/**/*.ts"],
    },
  },
});
