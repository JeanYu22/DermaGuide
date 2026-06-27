'use strict';

const { Schema, model } = require('mongoose');

/**
 * Product catalogue. Mirrors the original PureGlow product shape but adds the
 * commerce fields (slug, active flag, ratings) needed for a real shop.
 * Supplier / cost fields are kept server-side and never exposed to the
 * storefront API (see toStorefront()).
 */
const ProductSchema = new Schema(
  {
    sku: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    desc: { type: String, default: '' },
    price: { type: Number, required: true, min: 0 },
    emoji: { type: String, default: '🧴' },

    certs: { type: [String], default: [] }, // organic, vegan, cruelty-free
    concerns: { type: [String], default: [] }, // dryness, acne, ...
    types: { type: [String], default: [] }, // dry, oily, sensitive, all

    howToUse: { type: String, default: '' }, // brief application instructions
    keyIngredients: { type: [String], default: [] },

    stock: { type: Number, default: 0, min: 0 },
    active: { type: Boolean, default: true },

    rating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },

    // Internal-only fields (never sent to storefront)
    expiryDate: { type: String, default: '' },
    supplier: { type: String, default: '' },
    supplierContact: { type: String, default: '' },
    cost: { type: Number, default: 0 },
  },
  { timestamps: true }
);

ProductSchema.index({ name: 'text', desc: 'text', concerns: 'text' });

/** Public projection: strips supplier/cost/internal data. */
ProductSchema.methods.toStorefront = function toStorefront() {
  return {
    id: this._id.toString(),
    sku: this.sku,
    name: this.name,
    desc: this.desc,
    price: this.price,
    emoji: this.emoji,
    certs: this.certs,
    concerns: this.concerns,
    types: this.types,
    howToUse: this.howToUse,
    keyIngredients: this.keyIngredients,
    inStock: this.stock > 0,
    rating: this.rating,
    reviewCount: this.reviewCount,
  };
};

module.exports = model('Product', ProductSchema);
