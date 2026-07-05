'use strict';

const { Schema, model } = require('mongoose');

/**
 * Dropshipping supplier configuration.
 *
 * `type` selects the adapter:
 *   - 'api'  → a supplier with a real API (currently AliExpress DS API).
 *   - 'feed' → import from a CSV/JSON product feed/export (Spocket, BeautyJoint).
 *
 * Secrets for API suppliers (app key/secret/token) live in env, NOT here.
 * `config` holds non-secret, per-supplier settings (search keywords, feed URL,
 * column mapping, category filter, etc.).
 */
const SupplierSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true }, // aliexpress | spocket | beautyjoint | custom-*
    name: { type: String, required: true },
    type: { type: String, enum: ['api', 'feed'], required: true },
    enabled: { type: Boolean, default: false },

    // Retail price = supplierPrice * markup * currencyRate (rounded to .99).
    markup: { type: Number, default: 2.2 },
    currencyRate: { type: Number, default: 1 }, // supplier currency → USD

    // Only import items whose title/desc match these skincare keywords.
    categoryKeywords: { type: [String], default: ['skin', 'serum', 'cream', 'cleanser', 'moistur', 'mask', 'toner', 'sunscreen', 'spf', 'acne', 'facial', 'face'] },
    maxProducts: { type: Number, default: 50 },

    config: { type: Schema.Types.Mixed, default: {} }, // feedUrl, mapping, search terms, etc.

    lastSyncAt: { type: Date, default: null },
    lastResult: { type: Schema.Types.Mixed, default: {} }, // { imported, updated, skipped, error }
  },
  { timestamps: true }
);

module.exports = model('Supplier', SupplierSchema);
