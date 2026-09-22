// Renders the app icon at every size it's needed in, from one description of the mark.
// Chromium does the rasterising (it's already here for the tests), so there's no image
// library to install and the PNGs come out exactly as a browser would draw the SVG.
// Needs Playwright available (`npx playwright@latest install chromium` once), and is only
// run by hand when the mark changes — the PNGs it writes are committed, so nothing in a
// deploy depends on this.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const TEAL = '#004654', MINT = '#EDFFE9', GOLD = '#FFE13B';

// The sidebar's own mark: a wave and a dot. Source coordinates are the 60x40 box it's drawn
// in there, so the icon and the header can never drift apart.
const MARK_W = 48.1, MARK_H = 20.4, MARK_X = 2.3, MARK_Y = 6.3;
function mark({ size, fill, stroke, dot, dotFill, coverage, strokeBoost = 1 }) {
  const s = (size * coverage) / MARK_W;
  const tx = (size - MARK_W * s) / 2 - MARK_X * s;
  const ty = (size - MARK_H * s) / 2 - MARK_Y * s;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${fill}"/>
  <g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(4)})">
    <path d="M4 20 C 14 8, 22 8, 28 18 C 32 25, 38 25, 40 18" fill="none" stroke="${stroke}"
          stroke-width="${(3.4 * strokeBoost).toFixed(2)}" stroke-linecap="round"/>
    ${dot ? `<circle cx="47" cy="15" r="3.4" fill="${dotFill}"/>` : ''}
  </g>
</svg>`;
}
// A home-screen or tab icon is looked at small, so the mark is drawn heavier than in the
// header, and below 48px the dot is dropped — at that size it reads as dirt, not as a mark.
const full = size => mark({ size, fill: TEAL, stroke: MINT, dot: true, dotFill: GOLD, coverage: 0.72, strokeBoost: 1.15 });
const small = size => mark({ size, fill: TEAL, stroke: MINT, dot: false, coverage: 0.66, strokeBoost: 1.5 });
// Android crops a maskable icon to whatever shape the launcher uses, so the mark has to sit
// inside the middle 80% and the colour has to run to the very edge.
const maskable = size => mark({ size, fill: TEAL, stroke: MINT, dot: true, dotFill: GOLD, coverage: 0.52, strokeBoost: 1.15 });

const FILES = [
  ['favicon-16x16.png', 16, small], ['favicon-32x32.png', 32, small],
  ['favicon-48.png', 48, small],
  ['apple-touch-icon.png', 180, full], ['icon-192.png', 192, full], ['icon-512.png', 512, full],
  ['icon-maskable-192.png', 192, maskable], ['icon-maskable-512.png', 512, maskable],
];
const browser = await chromium.launch();
for (const [name, size, build] of FILES) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>html,body{margin:0;padding:0;overflow:hidden}</style>${build(size)}`);
  await page.screenshot({ path: name, omitBackground: false });
  await page.close();
  console.log('wrote', name, size + 'px');
}
await browser.close();
writeFileSync('favicon.svg', full(512).replace(` width="512" height="512"`, ''));
console.log('wrote favicon.svg');
