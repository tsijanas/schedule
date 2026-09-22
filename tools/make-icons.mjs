// Renders the app icon at every size it's needed in, from one description of the mark.
// Chromium does the rasterising (it's already here for the tests), so there's no image
// library to install and the PNGs come out exactly as a browser would draw the SVG.
// Needs Playwright available (`npx playwright@latest install chromium` once, or point
// CHROMIUM_PATH at a Chromium binary), and is only run by hand when the mark changes —
// the PNGs it writes are committed, so nothing in a deploy depends on this.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

// Straight off the brand slide template's "Expressive icons" page: the deep teal the app
// already runs on, and the mint it already draws in. Gold is the app's own accent, and it's
// the one warm colour on the tile, so it's what the eye lands on first.
const TEAL = '#004654', MINT = '#EDFFE9', GOLD = '#FFE13B';

// The mark, on the 24-unit grid the brand's expressive icons are drawn on: one stroke
// weight throughout, round caps, a generous corner radius, and a single solid dot as the
// only filled detail. It's a week with one day marked — the day that's yours, which is the
// only question anyone opens this tool to answer.
function mark({ stroke, width, hangers }) {
  return `
    <rect x="3" y="6" width="18" height="15" rx="4.6" fill="none" stroke="${stroke}" stroke-width="${width}"/>
    <path d="M3.9 11.2 H20.1" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>
    ${hangers ? `<path d="M8.6 3.1 V6.8" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>
    <path d="M15.4 3.1 V6.8" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round"/>` : ''}
    <circle cx="12" cy="16.2" r="2.15" fill="${GOLD}"/>`;
}

const GRID = 24;
function tile({ size, coverage, width, hangers, round = 0, margin = 0 }) {
  const inner = size - 2 * margin;
  const s = (inner * coverage) / GRID;
  const t = margin + (inner - GRID * s) / 2;
  // A square tile fills the whole canvas; the macOS one is a rounded tile inset in
  // transparency, because the Dock draws the PNG as-is and won't round it for you.
  const bg = round
    ? `<rect x="${margin}" y="${margin}" width="${inner}" height="${inner}" rx="${round}" fill="${TEAL}"/>`
    : `<rect width="${size}" height="${size}" fill="${TEAL}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${bg}
  <g transform="translate(${t.toFixed(2)} ${t.toFixed(2)}) scale(${s.toFixed(4)})">${mark({ stroke: MINT, width, hangers })}
  </g>
</svg>`;
}

// The brand template says it outright on its "Mini illustration" page: at small sizes use
// the less complex drawing. So below 48px the two hangers come off — at 16px they close up
// into a mint smudge on the top edge — and the remaining strokes thicken to hold the shape.
// 48px is the first size with room for them, so that's where the full drawing starts.
const full = size => tile({ size, coverage: 0.76, width: 2, hangers: true });
const small = size => tile({ size, coverage: 0.80, width: 2.5, hangers: false });
// Android crops a maskable icon to whatever shape the launcher uses, so the mark has to sit
// inside the middle 80% and the colour has to run to the very edge.
const maskable = size => tile({ size, coverage: 0.56, width: 2, hangers: true });
// macOS draws an app icon at ~80% of its canvas with rounded corners. Chrome hands the Dock
// the largest icon in the manifest untouched, so the inset and the rounding are baked in.
const mac = size => tile({
  size, coverage: 0.76, width: 2, hangers: true,
  margin: Math.round(size * 0.098), round: Math.round(size * 0.18),
});

const FILES = [
  ['favicon-16x16.png', 16, small], ['favicon-32x32.png', 32, small],
  ['favicon-48.png', 48, full],
  ['apple-touch-icon.png', 180, full], ['icon-192.png', 192, full], ['icon-512.png', 512, full],
  ['icon-maskable-192.png', 192, maskable], ['icon-maskable-512.png', 512, maskable],
  ['icon-mac-1024.png', 1024, mac],
];

// A tab strip and a Dock, drawn around the files just written, at the size they're really
// seen at. A mark that works at 512px and falls apart at 16px looks fine in a file listing
// and wrong in the only two places anyone meets it, so the check belongs next to the build.
function proofSheet(src) {
  const row = names => names.map(([f, w, label]) =>
    `<figure><img ${w ? `width="${w}"` : ''} src="${src(f)}"><figcaption>${label}</figcaption></figure>`
  ).join('');
  return `<!doctype html><meta charset="utf-8"><style>
  body{margin:0;padding:28px;background:#e9eaec;font:13px system-ui,-apple-system,sans-serif;color:#222}
  h2{font-size:13px;font-weight:600;margin:26px 0 10px;color:#444} h2:first-child{margin-top:0}
  .strip{background:#d3d6db;padding:9px 9px 0;border-radius:9px 9px 0 0;display:flex;gap:4px;width:620px}
  .tab{background:#fff;border-radius:9px 9px 0 0;padding:9px 13px;display:flex;align-items:center;
       gap:9px;font-size:12px;color:#3c4043;width:190px}
  .tab.dim{background:#c3c7cd;color:#4a4f55} .tab img{width:16px;height:16px;flex:0 0 16px}
  .dock{background:rgba(255,255,255,.38);border:1px solid rgba(255,255,255,.6);border-radius:24px;
        padding:8px 12px;display:inline-flex;gap:12px} .dock img{width:64px;height:64px;display:block}
  .onDark{background:#2c2f36;padding:22px;border-radius:14px;display:inline-block;margin-right:14px}
  .onLight{background:#cfd6e4;padding:22px;border-radius:14px;display:inline-block}
  .row{display:flex;gap:22px;align-items:flex-end;background:#fff;padding:16px;border-radius:10px}
  figure{margin:0;text-align:center;font-size:11px;color:#666} figure img{display:block;margin:0 auto 6px}
  .chk{background:linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%) 0 0/16px 16px,
       linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%) 8px 8px/16px 16px,#fff}
  </style>
  <h2>Chrome tab strip — the favicon at its real 16px</h2>
  <div class="strip">
    <div class="tab"><img src="${src('favicon-16x16.png')}"> Schedule</div>
    <div class="tab dim"><img src="${src('favicon-16x16.png')}"> Schedule — Coverage</div>
    <div class="tab dim"><img src="${src('favicon-16x16.png')}"> Schedule — People</div>
  </div>
  <h2>macOS Dock — icon-mac-1024.png at 64px, on a dark and a light desktop</h2>
  <div class="onDark"><div class="dock"><img src="${src('icon-mac-1024.png')}"></div></div>
  <div class="onLight"><div class="dock"><img src="${src('icon-mac-1024.png')}"></div></div>
  <h2>Every file at its own size — the chequerboard is transparency</h2>
  <div class="row">${row([
    ['favicon-16x16.png', 16, '16'], ['favicon-32x32.png', 32, '32'], ['favicon-48.png', 48, '48'],
    ['apple-touch-icon.png', 96, 'apple 180'], ['icon-192.png', 96, 'any 192'],
    ['icon-maskable-192.png', 96, 'maskable 192'],
  ])}<figure><img class="chk" width="96" src="${src('icon-mac-1024.png')}"><figcaption>mac 1024</figcaption></figure></div>
  <h2>The maskable one, cropped the way a launcher crops it</h2>
  <div class="row">
    <figure><img width="96" style="border-radius:50%" src="${src('icon-maskable-512.png')}"><figcaption>circle</figcaption></figure>
    <figure><img width="96" style="border-radius:22%" src="${src('icon-maskable-512.png')}"><figcaption>squircle</figcaption></figure>
    <figure><img width="96" src="${src('icon-512.png')}"><figcaption>any 512</figcaption></figure>
  </div>`;
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}
);
const png = {};
for (const [name, size, build] of FILES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>html,body{margin:0;padding:0;overflow:hidden;background:transparent}</style>${build(size)}`);
  // omitBackground leaves the macOS tile's corners transparent instead of filling them white.
  png[name] = await page.screenshot({ path: name, omitBackground: true });
  await page.close();
  console.log('wrote', name, size + 'px');
}
{
  // The buffers just written, inlined, so the sheet shows this run's output and not whatever
  // happened to be on disk beforehand.
  const src = f => 'data:image/png;base64,' + png[f].toString('base64');
  const page = await browser.newPage({ viewport: { width: 760, height: 900 }, deviceScaleFactor: 2 });
  await page.setContent(proofSheet(src));
  await page.screenshot({ path: 'tools/icon-proof.png', fullPage: true });
  await page.close();
  console.log('wrote tools/icon-proof.png');
}
await browser.close();

// Chrome prefers an SVG favicon over every PNG size offered next to it, and what it renders
// it into is a browser tab. So the scalable one is the small drawing, not the full one.
writeFileSync('favicon.svg', small(512).replace(` width="512" height="512"`, ''));
console.log('wrote favicon.svg');

// favicon.ico, packed here: an .ico is a short directory followed by its images, and each
// image is allowed to be a whole PNG, so the three small files above go in as they are.
const ICO = ['favicon-16x16.png', 'favicon-32x32.png', 'favicon-48.png'];
const dir = Buffer.alloc(6 + 16 * ICO.length);
dir.writeUInt16LE(0, 0); dir.writeUInt16LE(1, 2); dir.writeUInt16LE(ICO.length, 4);
let offset = dir.length;
ICO.forEach((name, i) => {
  const size = Number(name.match(/(\d+)(?:x\d+)?\.png$/)[1]);
  const at = 6 + 16 * i;
  dir.writeUInt8(size === 256 ? 0 : size, at);      // width, 0 meaning 256
  dir.writeUInt8(size === 256 ? 0 : size, at + 1);  // height
  dir.writeUInt8(0, at + 2);                        // palette entries: none, it's a PNG
  dir.writeUInt8(0, at + 3);                        // reserved
  dir.writeUInt16LE(1, at + 4);                     // colour planes
  dir.writeUInt16LE(32, at + 6);                    // bits per pixel
  dir.writeUInt32LE(png[name].length, at + 8);
  dir.writeUInt32LE(offset, at + 12);
  offset += png[name].length;
});
writeFileSync('favicon.ico', Buffer.concat([dir, ...ICO.map(n => png[n])]));
console.log('wrote favicon.ico', ICO.join(' + '));
