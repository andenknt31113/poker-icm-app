import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "dev.workers.andenknt31113.pokericm",
  appName: "Poker ICM",
  // playground のビルド出力をネイティブアプリに同梱する
  webDir: "playground/dist",
  ios: {
    contentInset: "always",
  },
};

export default config;
