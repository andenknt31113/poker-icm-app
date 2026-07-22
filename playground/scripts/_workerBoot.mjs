// worker_threads 用ブートストラップ（プレーン .mjs）。
// tsx の ESM フック（resolve 拡張子リマップ + TS 変換）をこのスレッドに登録してから
// 本体の .mts ワーカーを動的 import する。
// worker_threads では execArgv 経由の tsx ローダーが resolve リマップを行わないため、
// register() を明示的に呼ぶ必要がある。
import { register } from "tsx/esm/api";
import { workerData } from "node:worker_threads";

register();
await import(workerData.entry);
