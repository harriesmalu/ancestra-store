#!/usr/bin/env node
/**
 * generate-product-images.mjs — Genera las imágenes de producto con el nombre
 * de cada fragancia compuesto sobre la etiqueta del frasco.
 *
 * Uso:  node tools/generate-product-images.mjs
 * Requiere Playwright (usa la instalación de C:\Users\harri\career-ops-claude).
 *
 * - Perfumes: etiqueta con nombre (sin marcas de casas ajenas) y tamaño
 *   reescrito según variante (30/50/100 ml). Salida ~1000px JPEG.
 * - Body Splash: nombre debajo de "BODY SPLASH".
 * - Pack Travel Size: se deja la imagen genérica (el cliente elige 3 variedades).
 */
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire('file:///C:/Users/harri/career-ops-claude/package.json');
const { chromium } = require('playwright');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets', 'products');
const COMPOSITOR = 'file:///' + path.join(ROOT, 'tools', 'label-compositor.html').replace(/\\/g, '/');

// En la etiqueta no van las marcas de las casas originales
const BRAND_WORDS = ['DIOR', 'CHANEL', 'BVLGARI', 'ARMANI', 'LANCOME', 'LANCÔME'];
const labelName = name => name.split(' ')
  .filter(w => !BRAND_WORDS.includes(w.toUpperCase()))
  .join(' ').replace(/\s+/g, ' ').trim();

const PERFUME = { w: 1879, h: 1574, zoom: 0.5322 };  // salida ~1000px
const BS = { w: 832, h: 1059, zoom: 1 };

async function main() {
  const products = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'products.json'), 'utf8'));
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  const jobs = products.filter(p => p.category === 'Perfumes' || p.category === 'Body Splash');
  console.log(`Generando ${jobs.length} imágenes...`);

  const page = await browser.newPage();
  let n = 0;
  for (const p of jobs) {
    const isPerfume = p.category === 'Perfumes';
    const cfg = isPerfume ? PERFUME : BS;
    const vw = Math.ceil(cfg.w * cfg.zoom), vh = Math.ceil(cfg.h * cfg.zoom);
    await page.setViewportSize({ width: vw, height: vh });
    const params = new URLSearchParams({
      mode: isPerfume ? 'perfume' : 'bs',
      name: labelName(p.name),
      ml: String(p.volume_ml),
      zoom: String(cfg.zoom),
    });
    await page.goto(`${COMPOSITOR}?${params}`);
    await page.waitForFunction(() => document.title === 'READY');
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT, `${p.id}.jpg`), type: 'jpeg', quality: 82 });
    n++;
    if (n % 20 === 0) console.log(`  ${n}/${jobs.length}`);
  }
  await browser.close();
  console.log(`Listo: ${n} imágenes en assets/products/`);
}

main().catch(e => { console.error(e); process.exit(1); });
