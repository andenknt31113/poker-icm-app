#!/usr/bin/env node
// App Store Connect API クライアント (提出準備用)。
//
// 依存パッケージなし (Node 20+ の crypto / fetch のみ)。
//
//   export ASC_KEY_PATH=~/Downloads/AuthKey_XUG3J47FGA.p8
//   node scripts/asc-submit.mjs status
//   node scripts/asc-submit.mjs upload-screenshots --dir screenshots/ipad13-ja --locale ja
//   node scripts/asc-submit.mjs upload-iap-screenshot --file screenshots/ipad13-ja/06-paywall.png
//   node scripts/asc-submit.mjs prepare-submission
//
// prepare-submission は「審査用に追加」までで止める。最後の
// PATCH reviewSubmissions/{id} {submitted:true} はこのスクリプトでは行わない
// (ASC の画面から人が押す)。
//
// 参考: 資産アップロードは reserve → uploadOperations へ PUT → uploaded:true で
// commit → assetDeliveryState が COMPLETE になるまでポーリング、の 4 段構え。
import { createSign } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";

// ===== 対象アプリの固定値 =====
const APP_ID = "6793358140";
const BUNDLE_ID = "dev.workers.andenknt31113.pokericm";
const VERSION_STRING = "1.0";
const IAP_PRODUCT_ID = "pro_lifetime";
const ISSUER_ID = "68016291-d81f-462d-a56e-302fca7ffa93";
const KEY_ID = "XUG3J47FGA";

// iPad 13" (2064×2752) の投稿先。ASC の Web UI で「iPad 13インチ」と表示される枠は
// API 上はこの display type のまま (2048×2732 と 2064×2752 の両方を受け付ける)。
const IPAD_13_DISPLAY_TYPE = "APP_IPAD_PRO_3GEN_129";

const BASE = "https://api.appstoreconnect.apple.com";

// ===== 認証 (ES256 JWT) =====
function findPrivateKey(explicit) {
  const candidates = [
    explicit,
    process.env.ASC_KEY_PATH,
    ...[os.homedir(), path.join(os.homedir(), "Downloads"), path.join(os.homedir(), ".appstoreconnect", "private_keys"), process.cwd()]
      .map((d) => path.join(d, `AuthKey_${KEY_ID}.p8`)),
  ].filter(Boolean).map((p) => p.replace(/^~(?=\/|$)/, os.homedir()));

  for (const c of candidates) {
    try { if (statSync(c).isFile()) return c; } catch { /* 次の候補へ */ }
  }
  throw new Error(
    [
      `App Store Connect の秘密鍵 (AuthKey_${KEY_ID}.p8) が見つかりません。`,
      "探した場所:",
      ...candidates.map((c) => `  - ${c}`),
      "",
      "ASC → ユーザとアクセス → 統合 → App Store Connect API から鍵をダウンロードし、",
      "  export ASC_KEY_PATH=/path/to/AuthKey_XUG3J47FGA.p8",
      "を設定してから再実行してください (.p8 は再ダウンロード不可。無ければ再発行)。",
    ].join("\n"),
  );
}

let cachedToken = null;
function token(keyPath) {
  // 有効期限 20 分が上限。余裕を持って 15 分で作り直す。
  if (cachedToken && cachedToken.exp > Date.now() / 1000 + 60) return cachedToken.jwt;
  const privateKey = readFileSync(keyPath, "utf8");
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 15 * 60;
  const header = { alg: "ES256", kid: KEY_ID, typ: "JWT" };
  const payload = { iss: ISSUER_ID, iat, exp, aud: "appstoreconnect-v1" };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const signingInput = `${b64(header)}.${b64(payload)}`;
  const signer = createSign("SHA256");
  signer.update(signingInput);
  // JOSE の ES256 は R‖S の生の 64 バイト。Node の既定は DER なので明示的に変換する。
  const sig = signer.sign({ key: privateKey, dsaEncoding: "ieee-p1363" });
  cachedToken = { jwt: `${signingInput}.${sig.toString("base64url")}`, exp };
  return cachedToken.jwt;
}

// ===== HTTP =====
let KEY_PATH = null;

async function api(method, urlPath, body) {
  const url = urlPath.startsWith("http") ? urlPath : `${BASE}${urlPath}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token(KEY_PATH)}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 204) return null;
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* 非 JSON はそのまま出す */ }
  if (!res.ok) {
    const detail = json?.errors
      ? json.errors.map((e) => `${e.status} ${e.code}: ${e.title} — ${e.detail}`).join("\n  ")
      : text;
    throw new Error(`${method} ${url} → ${res.status}\n  ${detail}`);
  }
  return json;
}

const get = (p) => api("GET", p);
const post = (p, b) => api("POST", p, b);
const patch = (p, b) => api("PATCH", p, b);

/** JSON:API の 1件取得。0件なら null、複数なら先頭。 */
async function getOne(p) {
  const r = await get(p);
  return r?.data?.[0] ?? null;
}

// ===== 資産アップロード (screenshot 共通) =====
/**
 * reserve 済みアセットへ実体をアップロードし、COMPLETE になるまで待つ。
 * @param type "appScreenshots" | "inAppPurchaseAppStoreReviewScreenshots"
 */
async function uploadAsset(type, reserved, buffer) {
  const id = reserved.data.id;
  const ops = reserved.data.attributes.uploadOperations ?? [];
  if (ops.length === 0) throw new Error(`${type}/${id}: uploadOperations が空です`);

  for (const op of ops) {
    const chunk = buffer.subarray(op.offset, op.offset + op.length);
    const headers = {};
    for (const h of op.requestHeaders ?? []) headers[h.name] = h.value;
    // アップロード URL は署名済み・時間制限つきで、JWT は付けない (付けると 403)。
    const res = await fetch(op.url, { method: op.method, headers, body: chunk });
    if (!res.ok) {
      throw new Error(`${type}/${id} のチャンク送信に失敗: ${res.status} ${await res.text()}`);
    }
  }

  await patch(`/v1/${type}/${id}`, { data: { type, id, attributes: { uploaded: true } } });

  // Apple 側の検証 (サイズ・形式) は非同期。COMPLETE を確認してから次へ進む。
  for (let i = 0; i < 60; i++) {
    const cur = await get(`/v1/${type}/${id}`);
    const st = cur?.data?.attributes?.assetDeliveryState;
    if (st?.state === "COMPLETE") return id;
    if (st?.state === "FAILED") {
      throw new Error(`${type}/${id} の検証に失敗: ${JSON.stringify(st.errors)}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${type}/${id} が COMPLETE になりませんでした`);
}

// ===== 参照ヘルパー =====
async function iosVersion() {
  const v = await getOne(
    `/v1/apps/${APP_ID}/appStoreVersions?filter[versionString]=${VERSION_STRING}&filter[platform]=IOS&limit=1`,
  );
  if (!v) throw new Error(`バージョン ${VERSION_STRING} (IOS) が見つかりません`);
  return v;
}

async function iap() {
  const p = await getOne(
    `/v2/inAppPurchases?filter[app]=${APP_ID}&filter[productId]=${IAP_PRODUCT_ID}&limit=1`,
  );
  if (!p) throw new Error(`IAP ${IAP_PRODUCT_ID} が見つかりません`);
  return p;
}

// ===== コマンド: status =====
async function cmdStatus() {
  const app = await get(`/v1/apps/${APP_ID}`);
  console.log(`App : ${app.data.attributes.name} (${app.data.attributes.bundleId})`);
  if (app.data.attributes.bundleId !== BUNDLE_ID) {
    console.log(`  ⚠ 期待した Bundle ID (${BUNDLE_ID}) と違います`);
  }

  const v = await iosVersion();
  console.log(`Ver : ${v.attributes.versionString} — ${v.attributes.appStoreState ?? v.attributes.state}`);

  const build = await get(`/v1/appStoreVersions/${v.id}/build`).catch(() => null);
  console.log(`Build: ${build?.data ? `${build.data.attributes.version} (${build.data.attributes.processingState})` : "未添付"}`);

  const locs = await get(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`);
  console.log(`\nロケールとスクリーンショット:`);
  for (const loc of locs.data) {
    const sets = await get(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`);
    const summary = [];
    for (const s of sets.data) {
      const shots = await get(`/v1/appScreenshotSets/${s.id}/appScreenshots?limit=50`);
      summary.push(`${s.attributes.screenshotDisplayType}=${shots.data.length}枚`);
    }
    const has13 = sets.data.some((s) => s.attributes.screenshotDisplayType === IPAD_13_DISPLAY_TYPE);
    console.log(`  ${loc.attributes.locale.padEnd(8)} ${summary.join(" / ") || "(なし)"} ${has13 ? "" : "  ← iPad13 未登録"}`);
  }

  const p = await iap();
  console.log(`\nIAP : ${p.attributes.productId} — ${p.attributes.state}`);
  const shot = await get(`/v2/inAppPurchases/${p.id}/appStoreReviewScreenshot`).catch(() => null);
  console.log(`  審査用スクショ: ${shot?.data ? `${shot.data.attributes.fileName} (${shot.data.attributes.assetDeliveryState?.state})` : "未登録"}`);

  const subs = await get(`/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=READY_FOR_REVIEW,WAITING_FOR_REVIEW,IN_REVIEW,UNRESOLVED_ISSUES&limit=10`);
  console.log(`\n審査サブミッション: ${subs.data.length}件`);
  for (const s of subs.data) {
    const items = await get(`/v1/reviewSubmissions/${s.id}/items?limit=50`);
    console.log(`  ${s.id} state=${s.attributes.state} submitted=${s.attributes.submitted} items=${items.data.length}`);
  }
}

// ===== コマンド: upload-screenshots =====
async function cmdUploadScreenshots(opts) {
  const dir = path.resolve(opts.dir);
  const locale = opts.locale;
  const displayType = opts.display ?? IPAD_13_DISPLAY_TYPE;
  if (!dir || !locale) throw new Error("--dir と --locale は必須です");

  const v = await iosVersion();
  const locs = await get(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?limit=50`);
  const loc = locs.data.find((l) => l.attributes.locale === locale);
  if (!loc) {
    throw new Error(`ロケール ${locale} がありません (存在するのは: ${locs.data.map((l) => l.attributes.locale).join(", ")})`);
  }

  // 既存セットがあれば再利用する (同じ display type のセットは 1 つしか作れない)。
  const sets = await get(`/v1/appStoreVersionLocalizations/${loc.id}/appScreenshotSets?limit=50`);
  let set = sets.data.find((s) => s.attributes.screenshotDisplayType === displayType);
  if (!set) {
    const created = await post("/v1/appScreenshotSets", {
      data: {
        type: "appScreenshotSets",
        attributes: { screenshotDisplayType: displayType },
        relationships: {
          appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } },
        },
      },
    });
    set = created.data;
    console.log(`セット作成: ${displayType} (${locale})`);
  } else {
    const existing = await get(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
    if (existing.data.length > 0) {
      console.log(`⚠ ${locale}/${displayType} には既に ${existing.data.length} 枚あります。追加でアップロードします。`);
    }
  }

  // ストア掲載は 01〜05 のみ。06 (ペイウォール) は IAP 審査用なので除外する。
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".png") && !f.startsWith("06-"))
    .sort();
  if (files.length === 0) throw new Error(`${dir} に対象の png がありません`);

  const uploadedIds = [];
  for (const f of files) {
    const buf = readFileSync(path.join(dir, f));
    const reserved = await post("/v1/appScreenshots", {
      data: {
        type: "appScreenshots",
        attributes: { fileName: f, fileSize: buf.length },
        relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } },
      },
    });
    const id = await uploadAsset("appScreenshots", reserved, buf);
    uploadedIds.push(id);
    console.log(`  ✓ ${f}`);
  }

  // 表示順を確定する (ストア一覧のサムネイル順 = この配列順)。
  const all = await get(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
  const ordered = [
    ...uploadedIds,
    ...all.data.map((s) => s.id).filter((id) => !uploadedIds.includes(id)),
  ];
  await patch(`/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, {
    data: ordered.map((id) => ({ type: "appScreenshots", id })),
  });
  console.log(`完了: ${locale} / ${displayType} — ${files.length}枚`);
}

// ===== コマンド: upload-iap-screenshot =====
async function cmdUploadIapScreenshot(opts) {
  const file = path.resolve(opts.file);
  const buf = readFileSync(file);
  const p = await iap();

  // 審査用スクショは IAP につき 1 枚。既にあれば消してから貼り直す。
  const cur = await get(`/v2/inAppPurchases/${p.id}/appStoreReviewScreenshot`).catch(() => null);
  if (cur?.data) {
    await api("DELETE", `/v1/inAppPurchaseAppStoreReviewScreenshots/${cur.data.id}`);
    console.log(`既存の審査用スクショを削除: ${cur.data.attributes.fileName}`);
  }

  const reserved = await post("/v1/inAppPurchaseAppStoreReviewScreenshots", {
    data: {
      type: "inAppPurchaseAppStoreReviewScreenshots",
      attributes: { fileName: path.basename(file), fileSize: buf.length },
      relationships: { inAppPurchaseV2: { data: { type: "inAppPurchases", id: p.id } } },
    },
  });
  await uploadAsset("inAppPurchaseAppStoreReviewScreenshots", reserved, buf);
  console.log(`完了: IAP ${IAP_PRODUCT_ID} の審査用スクショ = ${path.basename(file)}`);
}

// ===== コマンド: prepare-submission =====
// 「審査用に追加」までを行う。submitted:true にはしない (最後は人が押す)。
async function cmdPrepareSubmission() {
  const v = await iosVersion();
  const p = await iap();

  // IAP は本体ではなく「バージョン」リソースを審査に載せる。
  const iapVersion = await getOne(`/v2/inAppPurchases/${p.id}/versions?limit=1`);
  if (!iapVersion) throw new Error(`IAP ${IAP_PRODUCT_ID} の version リソースが取得できません`);

  // 未提出のサブミッションがあれば再利用する (アプリにつき同時に 1 つ)。
  const open = await get(`/v1/reviewSubmissions?filter[app]=${APP_ID}&filter[state]=READY_FOR_REVIEW&limit=1`);
  let submission = open.data[0];
  if (!submission) {
    const created = await post("/v1/reviewSubmissions", {
      data: {
        type: "reviewSubmissions",
        attributes: { platform: "IOS" },
        relationships: { app: { data: { type: "apps", id: APP_ID } } },
      },
    });
    submission = created.data;
    console.log(`審査サブミッション作成: ${submission.id}`);
  } else {
    console.log(`既存の未提出サブミッションを使用: ${submission.id}`);
  }

  const items = await get(`/v1/reviewSubmissions/${submission.id}/items?limit=50&include=appStoreVersion,inAppPurchaseVersion`);
  const included = items.included ?? [];
  const hasVersion = included.some((i) => i.type === "appStoreVersions" && i.id === v.id);
  const hasIap = included.some((i) => i.type === "inAppPurchaseVersions" && i.id === iapVersion.id);

  if (!hasVersion) {
    await post("/v1/reviewSubmissionItems", {
      data: {
        type: "reviewSubmissionItems",
        relationships: {
          reviewSubmission: { data: { type: "reviewSubmissions", id: submission.id } },
          appStoreVersion: { data: { type: "appStoreVersions", id: v.id } },
        },
      },
    });
    console.log(`  + バージョン ${VERSION_STRING} を追加`);
  } else {
    console.log(`  = バージョン ${VERSION_STRING} は追加済み`);
  }

  if (!hasIap) {
    await post("/v1/reviewSubmissionItems", {
      data: {
        type: "reviewSubmissionItems",
        relationships: {
          reviewSubmission: { data: { type: "reviewSubmissions", id: submission.id } },
          inAppPurchaseVersion: { data: { type: "inAppPurchaseVersions", id: iapVersion.id } },
        },
      },
    });
    console.log(`  + IAP ${IAP_PRODUCT_ID} を追加`);
  } else {
    console.log(`  = IAP ${IAP_PRODUCT_ID} は追加済み`);
  }

  console.log("");
  console.log("ここまでが「審査用に追加」。提出はまだしていません。");
  console.log("ASC の画面で内容を確認してから「審査へ提出」を押してください。");
}

// ===== エントリポイント =====
function parseArgs(argv) {
  const cmd = argv[0];
  const opts = {};
  for (let i = 1; i < argv.length; i += 2) {
    const k = argv[i]?.replace(/^--/, "");
    if (k) opts[k] = argv[i + 1];
  }
  return { cmd, opts };
}

const USAGE = `usage: node scripts/asc-submit.mjs <command> [options]

  status                        現在の登録状況を表示 (どこが未完了か)
  upload-screenshots            ストア用スクショ (01〜05) をアップロード
      --dir <dir> --locale <ja|en-US> [--display APP_IPAD_PRO_3GEN_129]
  upload-iap-screenshot         IAP の「審査に関する情報」用スクショを 1 枚登録
      --file <png>
  prepare-submission            バージョンと IAP を「審査用に追加」(提出はしない)

  秘密鍵は --key / ASC_KEY_PATH / ~/Downloads/AuthKey_${KEY_ID}.p8 の順で探します。`;

async function main() {
  const { cmd, opts } = parseArgs(process.argv.slice(2));
  if (!cmd || cmd === "help" || cmd === "--help") { console.log(USAGE); return; }
  KEY_PATH = findPrivateKey(opts.key);

  switch (cmd) {
    case "status": return cmdStatus();
    case "upload-screenshots": return cmdUploadScreenshots(opts);
    case "upload-iap-screenshot": return cmdUploadIapScreenshot(opts);
    case "prepare-submission": return cmdPrepareSubmission();
    default:
      console.error(`unknown command: ${cmd}\n\n${USAGE}`);
      process.exitCode = 1;
  }
}

main().catch((e) => { console.error(`\n${e.message}`); process.exit(1); });
