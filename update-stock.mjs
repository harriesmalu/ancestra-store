#!/usr/bin/env node
/**
 * update-stock.mjs — Sincroniza el stock de data/products.json contra el
 * catálogo público del proveedor (Extracto Importado).
 *
 * Uso:  node update-stock.mjs [--dry-run]
 *
 * Añade/actualiza en cada producto:
 *   stock:         "disponible" | "ultimos" | "sin_stock"
 *   stock_label:   texto para mostrar en la tienda
 *   stock_updated: fecha ISO de la última sincronización
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PRODUCTS_PATH = path.join(ROOT, 'data', 'products.json');
const SUPPLIER_URL = 'https://admin.extractoimportado.com.ar/api/public/products';
const DRY_RUN = process.argv.includes('--dry-run');

// Alias: nombre local → equivalencia del proveedor (cuando difieren)
const ALIASES = {
  'SAUVAGE ELIXIR DIOR': 'SAUVAGE ELIXIR',
  'SAUVAGE DIOR': 'SAUVAGE',
  'BLEU CHANEL': 'BLEU CHANEL',
  'AVENTUS': 'CREED AVENTUS',
  'CHANCE EAU DE PARFUM': 'CHANCE CHANEL',
  "J'ADORE": 'JADORE',
  "L'INTERDIT": 'LINTERDIT',
  'SI': 'SI ARMANI',
  'IDOLE': 'IDOLE LANCOME',
  'LE MALE ELIXIR': 'LE MALE ELIXIR ABSOLU',
  'CLUB DE NUIT INTENSE': 'CLUB DE NUIT INTENSE',
  'PACK TRAVEL SIZE': '__DISCOVERY_SET__',
};

// Productos que el proveedor ya no lista: quedan sin stock hasta nuevo aviso
const DISCONTINUED = new Set(['fahrenheit-50', 'bright-crystal-50']);

const LABELS = {
  disponible: 'Disponible',
  ultimos: 'Últimas unidades',
  sin_stock: 'Sin stock',
};

const norm = s => (s || '')
  .toUpperCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const genderWord = g => g === 'Masculino' ? 'MASCULINO' : g === 'Femenino' ? 'FEMENINO' : null;

function catMatch(lp, sp) {
  const c = sp.category.name;
  if (lp.category === 'Perfumes') return c === 'Perfume';
  if (lp.category === 'Body Splash') return c === 'Body Splash';
  if (lp.category === 'Travel Size') return c === 'Travel Size' || c === 'Discovery Set';
  return true;
}

function findSupplier(lp, supplier, byEq) {
  if (ALIASES[lp.name] === '__DISCOVERY_SET__') {
    return supplier.find(p => p.category.name === 'Discovery Set') || null;
  }
  const n = norm(ALIASES[lp.name] || lp.name);
  const g = genderWord(lp.gender);
  const keys = [n];
  if (g) keys.push(`${n} ${g}`);
  for (const k of keys) {
    const list = (byEq.get(k) || []).filter(p => catMatch(lp, p));
    if (list.length) {
      if (list.length > 1 && g) {
        const gf = list.filter(p => norm(p.equivalence).includes(g));
        if (gf.length) return gf[0];
      }
      return list[0];
    }
  }
  // fuzzy: la equivalencia del proveedor empieza con el nombre local
  const fuzz = supplier.filter(p => {
    const e = norm(p.equivalence);
    return (e.startsWith(n + ' ') || n.startsWith(e + ' ')) && catMatch(lp, p);
  });
  if (fuzz.length && g) {
    const gf = fuzz.filter(p => norm(p.equivalence).includes(g));
    if (gf.length) return gf[0];
  }
  return fuzz[0] || null;
}

const sizeFor = lp =>
  lp.category === 'Body Splash' ? '200ml'
  : lp.category === 'Travel Size' ? '3x15ml'
  : `${lp.volume_ml}ml`;

async function main() {
  console.log(`Descargando catálogo del proveedor...`);
  const res = await fetch(SUPPLIER_URL);
  if (!res.ok) throw new Error(`Proveedor respondió ${res.status}`);
  const supplier = await res.json();
  console.log(`  ${supplier.length} productos del proveedor.`);

  const byEq = new Map();
  for (const p of supplier) {
    const k = norm(p.equivalence);
    if (!byEq.has(k)) byEq.set(k, []);
    byEq.get(k).push(p);
  }

  const local = JSON.parse(fs.readFileSync(PRODUCTS_PATH, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const rows = [];
  const warnings = [];

  for (const lp of local) {
    let slug;
    let detail = '';
    if (DISCONTINUED.has(lp.id)) {
      slug = 'sin_stock';
      detail = 'descatalogado por el proveedor';
    } else {
      const sp = findSupplier(lp, supplier, byEq);
      if (!sp) {
        slug = 'sin_stock';
        warnings.push(`SIN MATCH: ${lp.id} (${lp.name}) — marcado sin_stock`);
        detail = 'sin match';
      } else {
        const want = sizeFor(lp);
        const sz = sp.sizes.find(s => s.size === want);
        if (!sz) {
          slug = 'sin_stock';
          warnings.push(`SIN TALLA ${want}: ${lp.id} → ${sp.name}`);
          detail = `sin talla ${want}`;
        } else {
          slug = sz.stock.slug; // disponible | ultimos | sin_stock
          detail = `${sp.name} / ${sp.equivalence} ${want}`;
        }
      }
    }
    const changed = lp.stock !== slug;
    lp.stock = slug;
    lp.stock_label = LABELS[slug] || slug;
    lp.stock_updated = today;
    rows.push(`${changed ? '*' : ' '} ${lp.id.padEnd(22)} ${slug.padEnd(11)} ${detail}`);
  }

  console.log('\n  cambio | producto | stock | origen');
  console.log(rows.join('\n'));

  // ── Travel options del pack: filtrar fragancias agotadas en 15ml ──
  // Solo se elimina una opción si TODAS sus variantes travel size del
  // proveedor están sin stock. Si no hay match, se conserva (con aviso).
  const pack = local.find(p => p.id === 'pack-travel-size');
  if (pack && Array.isArray(pack.travel_options)) {
    const travelItems = supplier.filter(p => p.category.name === 'Travel Size');
    const optAliases = {
      'BLEU': 'BLEU CHANEL',
      'CREED': 'CREED AVENTUS',
      'BADE AL OUD HONOR & GLORY': 'BADE E AL OUD HONOR & GLORY',
      'LA NUIT TRESOR VANILLE': 'LA NUIT TRESOR VAINILLE',
      'MAN IN BLACK': 'BVLGARI MAN IN BLACK',
      'LE MALE ELIXIR': 'LE MALE ELIXIR ABSOLU',
      'L INTERDIT': 'LINTERDIT',
    };
    const kept = [];
    for (const opt of pack.travel_options) {
      const n = norm(optAliases[norm(opt)] || optAliases[opt] || opt);
      const variants = travelItems.filter(t => {
        const e = norm(t.equivalence);
        return e === n || e === `${n} FEMENINO` || e === `${n} MASCULINO` || e.startsWith(`${n} `);
      });
      if (!variants.length) {
        warnings.push(`TRAVEL OPTION sin match: "${opt}" — se conserva`);
        kept.push(opt);
        continue;
      }
      const anyAvailable = variants.some(v =>
        v.sizes.some(s => s.size === '15ml' && s.stock.slug !== 'sin_stock'));
      if (anyAvailable) kept.push(opt);
      else warnings.push(`TRAVEL OPTION agotada (15ml): "${opt}" — eliminada del pack`);
    }
    pack.travel_options = kept;
    console.log(`\nPack Travel Size: ${kept.length} opciones disponibles.`);
  }

  if (warnings.length) {
    console.log('\nAvisos:');
    warnings.forEach(w => console.log('  - ' + w));
  }

  const counts = local.reduce((a, p) => (a[p.stock] = (a[p.stock] || 0) + 1, a), {});
  console.log(`\nResumen: ${JSON.stringify(counts)}`);

  if (DRY_RUN) {
    console.log('\n--dry-run: no se escribió products.json');
  } else {
    fs.writeFileSync(PRODUCTS_PATH, JSON.stringify(local, null, 2) + '\n');
    console.log(`\nEscrito ${PRODUCTS_PATH}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
