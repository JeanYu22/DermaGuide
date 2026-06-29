'use strict';

/**
 * Normalises raw supplier items into DermaGuide Product fields.
 *
 * A "normalized item" (produced by each adapter) looks like:
 *   { externalId, title, description, price, currency, image, images[],
 *     url, available, brand, raw }
 */

// Keyword → skincare concern inference (so dropship items feed the AI matcher).
const CONCERN_KEYWORDS = {
  acne: ['acne', 'blemish', 'pimple', 'breakout', 'spot treatment', 'salicylic', 'tea tree'],
  dryness: ['dry', 'hydrat', 'moistur', 'hyaluronic', 'nourish'],
  dehydration: ['hydrat', 'water', 'dewy'],
  redness: ['redness', 'calm', 'soothing', 'cica', 'centella', 'sensitive'],
  sensitivity: ['sensitive', 'gentle', 'fragrance-free', 'calm'],
  pigmentation: ['bright', 'whitening', 'dark spot', 'vitamin c', 'niacinamide', 'even tone', 'glow'],
  wrinkles: ['anti-aging', 'anti aging', 'wrinkle', 'retinol', 'bakuchiol', 'peptide', 'firming', 'collagen'],
  'large pores': ['pore', 'blackhead', 'clay', 'charcoal', 'exfoliat', 'bha'],
  oily: ['oil control', 'oily', 'mattif', 'sebum'],
};

const TYPE_KEYWORDS = {
  dry: ['dry', 'nourish', 'rich'],
  oily: ['oily', 'oil control', 'mattif', 'sebum'],
  sensitive: ['sensitive', 'gentle', 'calm', 'cica'],
  combination: ['combination'],
  mature: ['anti-aging', 'wrinkle', 'mature', 'firming'],
};

function matchKeywords(text, map) {
  const t = (text || '').toLowerCase();
  const out = [];
  for (const [label, words] of Object.entries(map)) {
    if (words.some((w) => t.includes(w))) out.push(label);
  }
  return out;
}

function inferConcerns(text) {
  const c = matchKeywords(text, CONCERN_KEYWORDS);
  return c.length ? c : ['general care'];
}

function inferTypes(text) {
  const t = matchKeywords(text, TYPE_KEYWORDS);
  return t.length ? t : ['all'];
}

/** Charm-price rounding: 23.4 → 23.99, 8.2 → 8.99. */
function retailPrice(supplierPrice, markup, currencyRate) {
  const raw = (Number(supplierPrice) || 0) * (markup || 2.2) * (currencyRate || 1);
  if (raw <= 0) return 0;
  return Math.max(0.99, Math.floor(raw) + 0.99);
}

/** True if the item looks like skincare (per the supplier's category filter). */
function isRelevant(item, categoryKeywords) {
  if (!categoryKeywords || !categoryKeywords.length) return true;
  const hay = `${item.title || ''} ${item.description || ''} ${item.brand || ''}`.toLowerCase();
  return categoryKeywords.some((k) => hay.includes(k.toLowerCase()));
}

/**
 * Sourcing criteria filter. Drops items that fall outside the supplier's
 * configured price range / ship-from countries / MOQ. Only filters on data the
 * item actually carries (so a missing field never wrongly excludes an item).
 */
function passesCriteria(item, config = {}) {
  const price = Number(item.price);
  if (config.priceMin != null && price < config.priceMin) return false;
  if (config.priceMax != null && price > config.priceMax) return false;

  if (Array.isArray(config.shipFrom) && config.shipFrom.length && item.shipFrom) {
    const cc = String(item.shipFrom).toUpperCase();
    if (!config.shipFrom.map((c) => c.toUpperCase()).includes(cc)) return false;
  }
  if (config.moq != null && item.moq != null && Number(item.moq) > config.moq) return false;
  return true;
}

/** Map a normalized item → Product upsert document. */
function toProduct(item, supplier) {
  const text = `${item.title || ''} ${item.description || ''}`;
  const supplierPrice = Number(item.price) || 0;
  const images = (item.images && item.images.length ? item.images : [item.image]).filter(Boolean);

  return {
    sku: `${supplier.key}-${item.externalId}`,
    name: (item.title || 'Untitled').slice(0, 140),
    desc: (item.description || item.title || '').slice(0, 300),
    price: retailPrice(supplierPrice, supplier.markup, supplier.currencyRate),
    emoji: '🧴',
    brand: item.brand || '',
    images,
    concerns: inferConcerns(text),
    types: inferTypes(text),
    certs: [],
    stock: item.available === false ? 0 : Number(item.stock) > 0 ? Number(item.stock) : 25,
    active: true,

    source: supplier.key,
    dropship: true,
    externalId: String(item.externalId),
    externalUrl: item.url || '',

    supplier: supplier.name,
    supplierPrice: +(supplierPrice * (supplier.currencyRate || 1)).toFixed(2),
    cost: +(supplierPrice * (supplier.currencyRate || 1)).toFixed(2),
  };
}

module.exports = { toProduct, inferConcerns, inferTypes, retailPrice, isRelevant, passesCriteria };
