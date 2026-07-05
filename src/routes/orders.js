'use strict';

const express = require('express');
const crypto = require('crypto');
const Order = require('../models/Order');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const checkout = require('../services/checkout');

const router = express.Router();
router.use(requireAuth);

/**
 * POST /api/orders/checkout — demo (mock) checkout. Used when PayPal is not
 * configured; real card/PayPal payments go through /api/payments.
 */
router.post(
  '/checkout',
  asyncHandler(async (req, res) => {
    const order = await checkout.finalizeOrder(
      req.user._id,
      { method: 'mock', reference: `MOCK-${crypto.randomUUID()}` },
      req.body?.shippingAddress
    );
    res.status(201).json({ order });
  })
);

/** GET /api/orders — current user's order history. */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ orders });
  })
);

module.exports = router;
