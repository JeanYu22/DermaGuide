'use strict';

/**
 * Generic product-feed adapter for suppliers WITHOUT a public API
 * (BeautyJoint, Spocket exports, or any wholesaler data feed).
 *
 * Reads a CSV or JSON feed from a URL or inline content in supplier.config:
 *   config.feedUrl     - http(s) URL to a .csv or .json feed
 *   config.feedContent - inline CSV/JSON text (alternative to feedUrl)
 *   config.format      - 'csv' | 'json' (auto-detected if omitted)
 *   config.mapping     - maps feed columns → normalized fields, e.g.
 *       { externalId:'id', title:'name', description:'desc', price:'wholesale',
 *         image:'image_url', url:'product_url', brand:'brand', stock:'qty' }
 *   config.jsonPath    - for JSON feeds, dot-path to the array (e.g. 'products')
 */

const DEFAULT_MAPPING = {
  externalId: ['id', 'sku', 'product_id', 'handle'],
  title: ['title', 'name', 'product_name'],
  description: ['description', 'desc', 'body', 'body_html'],
  price: ['price', 'wholesale', 'wholesale_price', 'cost'],
  image: ['image', 'image_url', 'imageurl', 'images', 'thumbnail'],
  url: ['url', 'product_url', 'link'],
  brand: ['brand', 'vendor'],
  stock: ['stock', 'qty', 'quantity', 'inventory'],
};

/** Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, newlines). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (c === '\r') { /* skip */ }
    else field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1)
    .filter((r) => r.length && r.some((v) => v !== ''))
    .map((r) => Object.fromEntries(headers.map((h, idx) => [h, r[idx] ?? ''])));
}

function pick(record, candidates) {
  for (const key of candidates) {
    if (record[key] !== undefined && record[key] !== '') return record[key];
  }
  return '';
}

function getByPath(obj, path) {
  if (!path) return obj;
  return path.split('.').reduce((o, k) => (o ? o[k] : undefined), obj);
}

function mapRecord(record, mapping) {
  const get = (field) => {
    const m = mapping?.[field];
    if (Array.isArray(m)) return pick(record, m);
    if (typeof m === 'string') return record[m.toLowerCase()] ?? record[m] ?? '';
    return pick(record, DEFAULT_MAPPING[field] || []);
  };
  const imageRaw = get('image');
  const images = String(imageRaw || '').split(/[|,;\s]+/).filter((u) => /^https?:\/\//.test(u));
  return {
    externalId: String(get('externalId') || '').trim(),
    title: get('title'),
    description: get('description'),
    price: parseFloat(String(get('price')).replace(/[^0-9.]/g, '')) || 0,
    image: images[0] || (typeof imageRaw === 'string' ? imageRaw : ''),
    images,
    url: get('url'),
    brand: get('brand'),
    stock: parseInt(get('stock'), 10) || 0,
    available: true,
    raw: record,
  };
}

async function fetchText(config) {
  if (config.feedContent) return config.feedContent;
  if (!config.feedUrl) throw new Error('No feedUrl or feedContent configured for this supplier');
  const res = await fetch(config.feedUrl);
  if (!res.ok) throw new Error(`Feed fetch failed: HTTP ${res.status}`);
  return res.text();
}

/** Returns normalized items from the configured feed. */
async function fetchProducts(supplier) {
  const config = supplier.config || {};
  const text = await fetchText(config);
  const format = config.format || (text.trim().startsWith('[') || text.trim().startsWith('{') ? 'json' : 'csv');

  let records;
  if (format === 'json') {
    const data = JSON.parse(text);
    const arr = getByPath(data, config.jsonPath) || data;
    records = Array.isArray(arr) ? arr : [];
    // For JSON, flatten nested keys we care about via the same mapping.
    records = records.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.toLowerCase(), v])));
  } else {
    records = parseCsv(text);
  }

  return records
    .map((r) => mapRecord(r, config.mapping))
    .filter((it) => it.externalId && it.title && it.price > 0);
}

module.exports = { fetchProducts, parseCsv, mapRecord };
