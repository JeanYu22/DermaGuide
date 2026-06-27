'use strict';

const Product = require('../../models/Product');
const Supplier = require('../../models/Supplier');
const normalize = require('./normalize');
const feed = require('./feed');
const aliexpress = require('./aliexpress');

/** Pick the adapter for a supplier. */
function adapterFor(supplier) {
  if (supplier.key === 'aliexpress' || supplier.type === 'api') return aliexpress;
  if (supplier.type === 'feed') return feed;
  throw new Error(`No adapter for supplier "${supplier.key}" (type ${supplier.type})`);
}

/**
 * Sync one supplier: fetch → filter to skincare → cap → upsert as dropship
 * Products. Returns a result summary and records it on the supplier doc.
 */
async function syncSupplier(supplier) {
  const result = { imported: 0, updated: 0, skipped: 0, error: null };
  try {
    const adapter = adapterFor(supplier);
    let items = await adapter.fetchProducts(supplier);

    items = items.filter((it) => normalize.isRelevant(it, supplier.categoryKeywords));
    items = items.slice(0, supplier.maxProducts || 50);

    for (const item of items) {
      if (!item.externalId || !item.price) { result.skipped += 1; continue; }
      const doc = normalize.toProduct(item, supplier);
      const existing = await Product.findOne({ source: supplier.key, externalId: doc.externalId });
      if (existing) {
        // Refresh price/stock/images but keep any manual edits to concerns/howToUse.
        existing.price = doc.price;
        existing.stock = doc.stock;
        existing.images = doc.images;
        existing.supplierPrice = doc.supplierPrice;
        existing.cost = doc.cost;
        existing.active = true;
        await existing.save();
        result.updated += 1;
      } else {
        await Product.create(doc);
        result.imported += 1;
      }
    }
  } catch (err) {
    result.error = err.message;
  }

  supplier.lastSyncAt = new Date();
  supplier.lastResult = result;
  await supplier.save().catch(() => {});
  return result;
}

/** Sync every enabled supplier. */
async function syncAll() {
  const suppliers = await Supplier.find({ enabled: true });
  const out = {};
  for (const s of suppliers) out[s.key] = await syncSupplier(s);
  return out;
}

module.exports = { syncSupplier, syncAll, adapterFor };
