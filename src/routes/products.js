'use strict';

const express = require('express');
const Product = require('../models/Product');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/** GET /api/products — storefront listing with optional filters. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { concern, type, search } = req.query;
    const query = { active: true };
    if (concern) query.concerns = concern;
    if (type) query.types = { $in: [type, 'all'] };
    if (search) query.$text = { $search: search };

    const products = await Product.find(query).sort({ createdAt: 1 }).limit(100);
    res.json({ products: products.map((p) => p.toStorefront()) });
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
