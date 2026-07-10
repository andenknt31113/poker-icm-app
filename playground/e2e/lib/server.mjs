// vite preview サーバーの起動・待ち受け・停止ヘルパー。
//
// `npm run e2e` はビルド済みの dist を `vite preview` で配信してスイートを
// 実行する想定 (CI では事前に `npm run build` 済み)。ローカルで dist が無い
// 場合の利便性のため、無ければ自動で一度だけ `vite build` する。
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const PLAYGROUND_ROOT = path.resolve(__dirname, "..", "..");
const REPO_ROOT = path.resolve(PLAYGROUND_ROOT, "..");
const DIST_DIR = path.join(PLAYGROUND_ROOT, "dist");
const VITE_BIN = path.join(REPO_ROOT, "node_modules", "vite", "bin", "vite.js");

const SERVER_READY_TIMEOUT_MS = 20_000;

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : null;
      srv.close(() => {
        if (port) resolve(port);
        else reject(new Error("空きポートの取得に失敗しました"));
      });
    });
  });
}

/** dist/index.html が無ければ一度だけ vite build する。 */
export function ensureBuilt() {
  const indexHtml = path.join(DIST_DIR, "index.html");
  if (existsSync(indexHtml)) return;
  console.log("[e2e] playground/dist が見つからないため `vite build` を実行します...");
  const result = spawnSync(process.execPath, [VITE_BIN, "build"], {
    cwd: PLAYGROUND_ROOT,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error("vite build に失敗しました (npm run build を先に実行してください)");
  }
  if (!existsSync(indexHtml)) {
    throw new Error("vite build 後も dist/index.html が見つかりません");
  }
}

/** vite preview を空きポートで起動し、応答が返るまで待って {baseURL, stop} を返す。 */
export async function startPreviewServer() {
  const port = await findFreePort();
  const proc = spawn(
    process.execPath,
    [VITE_BIN, "preview", "--port", String(port), "--strictPort", "--host", "127.0.0.1"],
    {
      cwd: PLAYGROUND_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let stderrBuf = "";
  let exited = false;
  let exitInfo = "";
  proc.stderr.on("data", (chunk) => {
    stderrBuf += chunk.toString();
  });
  proc.once("exit", (code, signal) => {
    exited = true;
    exitInfo = `code=${code} signal=${signal}`;
  });

  const baseURL = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  let lastError;
  while (Date.now() < deadline) {
    if (exited) {
      throw new Error(`vite preview が起動前に終了しました (${exitInfo})\n${stderrBuf}`);
    }
    try {
      const res = await fetch(baseURL);
      if (res.ok) {
        return {
          baseURL,
          port,
          stop: () => {
            if (!proc.killed) proc.kill("SIGKILL");
          },
        };
      }
    } catch (e) {
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill("SIGKILL");
  throw new Error(
    `vite preview が ${SERVER_READY_TIMEOUT_MS}ms 以内に応答しませんでした: ${lastError}\n${stderrBuf}`,
  );
}
