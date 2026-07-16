import { execSync } from "node:child_process";
import { defineConfig } from "vite";

// ビルド時点の git commit SHA (短縮形) を埋め込む。
// デプロイ後の動作確認で「本番に表示される build SHA」と「main ブランチの
// 最新 SHA」を照合できるようにするための布石。
// git が使えない環境 (git 未インストールの Docker ビルドイメージ等) でも
// ビルド自体は落とさず "dev" にフォールバックする。
function resolveAppVersion(): string {
  try {
    return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "dev";
  }
}

export default defineConfig({
  server: {
    port: 5173,
    open: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(resolveAppVersion()),
  },
});
