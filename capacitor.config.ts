import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.workers.andenknt31113.pokericm",
  appName: "Poker ICM",
  // playground のビルド出力をネイティブアプリに同梱する
  webDir: "playground/dist",
  ios: {
    // WebView をステータスバー下まで広げ、上部の余白は CSS の
    // env(safe-area-inset-top) だけで確保する。"always" にすると
    // ネイティブ側のインセットと CSS の safe-area が二重掛けになり、
    // ヘッダー上に大きな空白ができる (実機で確認済み)。
    contentInset: "never",
  },
};

export default config;
