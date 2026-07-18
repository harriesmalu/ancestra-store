#!/usr/bin/env node
/**
 * bump-asset-version.mjs — Actualiza el parámetro ?v= de los CSS/JS en los HTML
 * para invalidar el caché del navegador en cada deploy.
 *
 * Uso:  node tools/bump-asset-version.mjs   (correr antes de commitear cambios de css/js)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = ['index.html', 'product.html', 'cart.html', 'checkout.html', 'success.html'];
const v = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');

for (const page of PAGES) {
  const file = path.join(ROOT, page);
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/(href="css\/[^"?]+)(\?v=[^"]*)?"/g, `$1?v=${v}"`);
  html = html.replace(/(src="js\/[^"?]+)(\?v=[^"]*)?"/g, `$1?v=${v}"`);
  fs.writeFileSync(file, html);
  console.log(`${page} → v=${v}`);
}
