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
    // FULL_VERSION=1 で「最初から Pro 解放」の完全版ビルドになる
    // (別 Worker への限定配布用。通常ビルドでは false に畳まれてコードごと消える)
    __FULL_VERSION__: JSON.stringify(process.env.FULL_VERSION === "1"),
  },
  plugins: [
    {
      // 完全版は検索エンジンに載せない (公開 freemium 版の canonical を守る)
      name: "full-version-noindex",
      transformIndexHtml(html: string) {
        if (process.env.FULL_VERSION !== "1") return html;
        return html.replace(
          "</title>",
          '</title>\n    <meta name="robots" content="noindex" />',
        );
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        // 事前計算 equity データ (約390KB、デプロイ間でほぼ不変) をアプリ本体と
        // 別チャンクに分ける。デプロイごとに SW が再取得するのは本体 (~135KB) だけに
        // なり、取得も並列化される。読み込みタイミング自体は静的 import のまま。
        manualChunks(id: string): string | undefined {
          if (id.includes("/src/data/")) return "equity-data";
          return undefined;
        },
      },
    },
  },
});
