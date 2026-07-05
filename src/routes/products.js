'use strict';

const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/**
 * GET /api/products/recommendations/for-me — implicit recommender.
 *
 * For signed-in users who have NOT run a skin analysis, builds a lightweight
 * taste profile from (a) saved preferences, (b) order history, and (c)
 * recently viewed products, then ranks the catalogue by overlap with that
 * profile plus a popularity prior. Guests / cold-start fall back to
 * popularity. (Analysis-based recommendations remain the primary path and
 * are handled client-side from the last analysis.)
 */
router.get(
  '/recommendations/for-me',
  asyncHandler(async (req, res) => {
    const limit = Math.min(12, Math.max(1, parseInt(req.query.limit, 10) || 6));
    const products = await Product.find({ active: true });

    const concernSignals = new Map(); // concern -> weight
    const typeSignals = new Map();
    let prefSkinType = '';
    const bump = (map, key, w) => { const k = String(key || '').toLowerCase(); if (k) map.set(k, (map.get(k) || 0) + w); };

    let source = 'popular';
    if (req.user) {
      const prefs = req.user.preferences || {};
      (prefs.concerns || []).forEach((c) => bump(concernSignals, c, 3));
      (prefs.categories || []).forEach((t) => bump(typeSignals, t, 2));
      prefSkinType = (prefs.skinType || req.user.skinProfile?.skinType || '').toLowerCase();
      (req.user.skinProfile?.concerns || []).forEach((c) => bump(concernSignals, c, 2));

      // Order history: what they actually bought carries strong signal.
      const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(10);
      const boughtIds = orders.flatMap((o) => o.items.map((i) => String(i.product)));
      // Recently viewed: weaker signal.
      const viewedIds = (req.user.recentViews || []).slice(0, 20);
      const byId = new Map(products.map((p) => [p._id.toString(), p]));
      boughtIds.forEach((id) => { const p = byId.get(id); if (p) { p.concerns.forEach((c) => bump(concernSignals, c, 2)); p.types.forEach((t) => bump(typeSignals, t, 1.5)); } });
      viewedIds.forEach((id) => { const p = byId.get(id); if (p) { p.concerns.forEach((c) => bump(concernSignals, c, 1)); p.types.forEach((t) => bump(typeSignals, t, 0.75)); } });

      if (concernSignals.size || typeSignals.size || prefSkinType) source = 'implicit';
    }

    const popularity = (p) => (p.rating || 0) * Math.log10((p.reviewCount || 0) + 2);
    const score = (p) => {
      let s = popularity(p) * 0.6;
      p.concerns.forEach((c) => { s += concernSignals.get(String(c).toLowerCase()) || 0; });
      p.types.forEach((t) => { s += typeSignals.get(String(t).toLowerCase()) || 0; });
      if (prefSkinType && p.types.map((t) => String(t).toLowerCase()).includes(prefSkinType)) s += 1.5;
      return s;
    };

    const ranked = products
      .map((p) => ({ p, s: score(p) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(({ p }) => p.toStorefront());

    res.json({ source, products: ranked });
  })
);

/** POST /api/products/:id/view — log an implicit "viewed" signal (signed-in only). */
router.post(
  '/:id/view',
  asyncHandler(async (req, res) => {
    if (!req.user) return res.status(204).end();
    const id = String(req.params.id);
    const views = (req.user.recentViews || []).filter((v) => v !== id);
    views.unshift(id);
    req.user.recentViews = views.slice(0, 20);
    await req.user.save().catch(() => {});
    res.status(204).end();
  })
);

/** GET /api/products — paginated storefront listing with optional filters. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { concern, type, search } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(48, Math.max(1, parseInt(req.query.limit, 10) || 24));

    const query = { active: true };
    if (concern && concern !== 'all') query.concerns = concern;
    if (type) query.types = { $in: [type, 'all'] };
    // Use a regex search (works without a text index and matches partials).
    if (search) {
      const rx = new RegExp(String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ name: rx }, { desc: rx }, { brand: rx }, { concerns: rx }];
    }

    const total = await Product.countDocuments(query);
    const products = await Product.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      products: products.map((p) => p.toStorefront()),
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  })
);

/** GET /api/products/:id — single product (storefront projection). */
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findOne({ _id: req.params.id, active: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product: product.toStorefront() });
  })
);

module.exports = router;
