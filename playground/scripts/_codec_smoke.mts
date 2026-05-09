// シナリオ URL 共有の encode/decode round-trip をチェックする smoke script。
// main.ts の encodeStateToHash / decodeStateFromHash と同じロジックを純粋関数として再現。
// DOM 依存を持たないので Node でそのまま実行できる。
//
// 実行: npx tsx playground/scripts/_codec_smoke.mts
import { strict as assert } from "node:assert";

interface Compact {
  p: [number, string, string][]; // [stack, role[0], position]
  py: number[];
  n: { sb: number; bb: number; a: number; m: "p" | "t" };
}

function encode(c: Compact): string {
  return Buffer.from(encodeURIComponent(JSON.stringify(c))).toString("base64");
}

function decode(hash: string): Compact {
  const json = decodeURIComponent(Buffer.from(hash, "base64").toString("utf8"));
  return JSON.parse(json) as Compact;
}

const cases: { label: string; data: Compact }[] = [
  {
    label: "HU 10/10 ante=1 BB-ante",
    data: {
      p: [[10, "h", "BTN"], [10, "v", "BB"]],
      py: [100],
      n: { sb: 0.5, bb: 1, a: 1, m: "t" },
    },
  },
  {
    label: "9-max FT ICM",
    data: {
      p: [
        [35, "h", "BTN"], [28, "v", "SB"], [22, "o", "BB"],
        [18, "o", "UTG"], [15, "o", "UTG+1"], [12, "o", "MP"],
        [10, "o", "LJ"], [7, "o", "HJ"], [5, "o", "CO"],
      ],
      py: [40, 25, 15, 10, 5, 3, 2, 1, 0.5],
      n: { sb: 0.5, bb: 1, a: 1, m: "t" },
    },
  },
  {
    label: "サテライト (perPlayer ante)",
    data: {
      p: [[28, "o", "BTN"], [22, "h", "SB"], [18, "o", "BB"], [15, "o", "CO"], [5, "v", "HJ"]],
      py: [33, 33, 33],
      n: { sb: 0.5, bb: 1, a: 0.25, m: "p" },
    },
  },
];

let failed = 0;
for (const { label, data } of cases) {
  const hash = encode(data);
  const restored = decode(hash);
  try {
    assert.deepEqual(restored, data, `${label}: round-trip mismatch`);
    // URL に乗せられる長さチェック (RFC 7230 8KB 推奨内)
    assert.ok(hash.length < 8000, `${label}: hash too long (${hash.length})`);
    console.log(`✓ ${label} (hash ${hash.length} chars)`);
  } catch (e) {
    failed += 1;
    console.error(`✗ ${label}:`, e instanceof Error ? e.message : e);
  }
}

if (failed > 0) {
  console.error(`\n${failed} / ${cases.length} ケース失敗`);
  process.exit(1);
}
console.log(`\n✅ 全 ${cases.length} ケース round-trip OK`);
