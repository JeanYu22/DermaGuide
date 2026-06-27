'use strict';

const crypto = require('crypto');
const config = require('../../config');

/**
 * AliExpress Dropshipping adapter — Alibaba Open Platform (TOP) gateway.
 *
 * Requires (in .env):
 *   ALIEXPRESS_APP_KEY, ALIEXPRESS_APP_SECRET, ALIEXPRESS_ACCESS_TOKEN
 * obtained after registering an app and getting dropshipper approval + OAuth.
 *
 * Uses the DS product search method to source skincare items. The exact method
 * name / fields can vary by the API version your app is approved for, so the
 * search method and response field names are configurable via supplier.config.
 *
 * NOTE: This issues live, signed calls to AliExpress; it can only run once you
 * provide valid credentials. Without them it throws a clear "not configured"
 * error so the rest of the platform keeps working.
 */

function configured() {
  return Boolean(config.aliexpress.appKey && config.aliexpress.appSecret && config.aliexpress.accessToken);
}

/** TOP signature (MD5): sort params, concat secret+k+v...+secret, MD5 upper-hex. */
function sign(params, secret) {
  const sorted = Object.keys(params).sort();
  let base = secret;
  for (const k of sorted) base += k + params[k];
  base += secret;
  return crypto.createHash('md5').update(base, 'utf8').digest('hex').toUpperCase();
}

function timestamp() {
  // TOP expects 'yyyy-MM-dd HH:mm:ss' in GMT+8.
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

async function call(method, businessParams = {}) {
  if (!configured()) {
    throw new Error('AliExpress API not configured — set ALIEXPRESS_APP_KEY / ALIEXPRESS_APP_SECRET / ALIEXPRESS_ACCESS_TOKEN');
  }

  const params = {
    method,
    app_key: config.aliexpress.appKey,
    session: config.aliexpress.accessToken,
    timestamp: timestamp(),
    format: 'json',
    v: '2.0',
    sign_method: 'md5',
    ...flatten(businessParams),
  };
  params.sign = sign(params, config.aliexpress.appSecret);

  const body = new URLSearchParams(params).toString();
  const res = await fetch(config.aliexpress.gateway, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`AliExpress HTTP ${res.status}`);
  const data = await res.json();
  if (data.error_response) {
    throw new Error(`AliExpress error: ${data.error_response.msg || JSON.stringify(data.error_response)}`);
  }
  return data;
}

// AliExpress wants nested objects as JSON strings.
function flatten(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  return out;
}

/** Best-effort extraction of a product array from varied response shapes. */
function extractProducts(data) {
  const resp = Object.values(data)[0] || data; // unwrap *_response
  const candidates = [
    resp?.resp_result?.result?.products?.product,
    resp?.result?.products?.product,
    resp?.products?.product,
    resp?.result?.products,
    resp?.products,
  ];
  for (const c of candidates) if (Array.isArray(c)) return c;
  return [];
}

function normalize(p) {
  const price = parseFloat(p.target_sale_price ?? p.sale_price ?? p.app_sale_price ?? p.original_price ?? 0) || 0;
  const images = [p.product_main_image_url, ...(Array.isArray(p.product_small_image_urls?.string) ? p.product_small_image_urls.string : [])].filter(Boolean);
  return {
    externalId: String(p.product_id ?? p.productId ?? p.item_id ?? ''),
    title: p.product_title ?? p.subject ?? p.title ?? '',
    description: p.product_title ?? p.subject ?? '',
    price,
    currency: p.target_sale_price_currency || 'USD',
    image: images[0] || '',
    images,
    url: p.product_detail_url ?? p.promotion_link ?? '',
    brand: p.brand_name || '',
    available: true,
    raw: p,
  };
}

/** Search AliExpress for skincare items using the supplier's keywords. */
async function fetchProducts(supplier) {
  const cfg = supplier.config || {};
  const method = cfg.searchMethod || 'aliexpress.ds.text.search';
  const keywords = (cfg.searchKeywords && cfg.searchKeywords.length ? cfg.searchKeywords : ['face serum', 'moisturizer', 'cleanser', 'acne treatment']);
  const pageSize = Math.min(50, supplier.maxProducts || 50);

  const all = [];
  for (const kw of keywords) {
    const data = await call(method, {
      keyWord: kw,
      keywords: kw, // some versions use `keywords`
      local: 'en_US',
      countryCode: cfg.shipTo || 'US',
      currency: 'USD',
      pageSize,
      pageIndex: 1,
      ...(cfg.searchParams || {}),
    });
    for (const p of extractProducts(data)) all.push(normalize(p));
    if (all.length >= (supplier.maxProducts || 50)) break;
  }
  return all;
}

module.exports = { fetchProducts, call, sign, configured };
