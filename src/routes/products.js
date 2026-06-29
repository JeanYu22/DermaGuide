'use strict';

const express = require('express');
const Product = require('../models/Product');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

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
