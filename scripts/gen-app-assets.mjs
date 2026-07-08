import sharp from "sharp";
import { writeFileSync } from "node:fs";

// アプリアイコン: 角丸なしのフルスクエア (iOS が自前でマスクするため)
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a2840"/>
      <stop offset="100%" stop-color="#0a0d12"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <text x="512" y="600" font-family="DejaVu Sans, sans-serif" font-size="400" font-weight="bold" fill="#38a8ff" text-anchor="middle">ICM</text>
  <text x="512" y="760" font-family="DejaVu Sans, sans-serif" font-size="110" font-weight="bold" fill="#66bb6a" text-anchor="middle">BF · Nash</text>
</svg>`;

// スプラッシュ: アプリのテーマ色背景にアイコンを中央配置
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#0f1419"/>
  <text x="1366" y="1320" font-family="DejaVu Sans, sans-serif" font-size="420" font-weight="bold" fill="#38a8ff" text-anchor="middle">ICM</text>
  <text x="1366" y="1500" font-family="DejaVu Sans, sans-serif" font-size="130" font-weight="bold" fill="#66bb6a" text-anchor="middle">BF · Nash</text>
</svg>`;

async function render(svg, size, out) {
  const png = await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toBuffer();
  writeFileSync(out, png);
  console.log(`wrote ${out} (${size}x${size})`);
}

await render(iconSvg, 1024, "assets/icon-only.png");
await render(iconSvg, 1024, "assets/icon-foreground.png");
await render(splashSvg, 2732, "assets/splash.png");
await render(splashSvg, 2732, "assets/splash-dark.png");
