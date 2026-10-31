/**
 * `pnpm --filter @click-bot/web icons`: favicons and app icons from the logo mark (Figma,
 * component Sidebar → Logo-Mark, node 1:40; the same as the LogoMark atom). Renders the SVG with
 * Playwright's Chromium and packs 16, 32 and 48 px into favicon.ico. Run again after a new logo.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const PRIMARY = '#4f46e5';
const app = (name) => fileURLToPath(new URL(`../src/app/${name}`, import.meta.url));
const pub = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

// The cursor with its rays, white on the brand colour.
const GLYPH = `<g stroke="#fff" stroke-width="1.6666" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <path d="M17.6662 9.4165L15.9996 10.9998"/>
    <path d="M10.2498 12.6664L7.83326 11.9998"/>
    <path d="M10.9998 15.9996L9.41653 17.6662"/>
    <path d="M11.9998 7.83325L12.6664 10.2498"/>
    <path d="M13.5305 14.0747a.42.42 0 0 1 .5442-.5441l9.1663 3.7498a.42.42 0 0 1-.0617.7908l-3.624.8675a.83.83 0 0 0-.6167.6158l-.8666 3.6248a.42.42 0 0 1-.7916.0617l-3.7499-9.1663Z"/>
  </g>`;

/** Rounded like in the sidebar: tabs and bookmarks. */
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <path d="M24 0H8C3.58 0 0 3.58 0 8v16c0 4.42 3.58 8 8 8h16c4.42 0 8-3.58 8-8V8c0-4.42-3.58-8-8-8Z" fill="${PRIMARY}"/>
  ${GLYPH}
</svg>
`;

/** Square to the edge: iOS and Android round or cut the icon themselves. */
const square = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" fill="none">
  <rect width="32" height="32" fill="${PRIMARY}"/>
  ${GLYPH}
</svg>
`;

/** An .ico that holds PNG images, which every current browser reads. */
function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = header.length;
  images.forEach(({ size, png }, index) => {
    const entry = 6 + 16 * index;
    header.writeUInt8(size % 256, entry);
    header.writeUInt8(size % 256, entry + 1);
    header.writeUInt16LE(1, entry + 4);
    header.writeUInt16LE(32, entry + 6);
    header.writeUInt32LE(png.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += png.length;
  });
  return Buffer.concat([header, ...images.map((image) => image.png)]);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const render = async (svg, size) => {
    await page.setViewportSize({ width: size, height: size });
    const sized = svg.replace('width="32" height="32"', `width="${size}" height="${size}"`);
    await page.setContent(`<style>*{margin:0}svg{display:block}</style>${sized}`);
    return page.locator('svg').screenshot({ omitBackground: true });
  };

  await writeFile(app('icon.svg'), rounded);
  const sizes = [16, 32, 48];
  const pngs = [];
  for (const size of sizes) pngs.push({ size, png: await render(rounded, size) });
  await writeFile(app('favicon.ico'), ico(pngs));
  await writeFile(app('apple-icon.png'), await render(square, 180));
  await writeFile(pub('icon-192.png'), await render(rounded, 192));
  await writeFile(pub('icon-512.png'), await render(rounded, 512));
  await writeFile(pub('icon-maskable-512.png'), await render(square, 512));
} finally {
  await browser.close();
}
