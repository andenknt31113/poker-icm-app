/// <reference types="vite/client" />

// vite.config.ts の define で埋め込まれるビルド時 git commit SHA (短縮形)。
// git が使えないビルド環境では "dev" にフォールバックする。
declare const __APP_VERSION__: string;
