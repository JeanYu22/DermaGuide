'use strict';

const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const checkout = require('../services/checkout');
const paypal = require('../services/paypal');

const router = express.Router();

/** GET /api/payments/config — what the storefront should render. */
router.get('/config', (_req, res) => {
  res.json({
    paypal: {
      enabled: paypal.configured(),
      clientId: paypal.clientId(), // public client id (safe to expose)
      currency: paypal.currency(),
      env: paypal.env(),
    },
  });
});

router.use(requireAuth);

/** POST /api/payments/paypal/create-order — create a PayPal order from the cart. */
router.post(
  '/paypal/create-order',
  asyncHandler(async (req, res) => {
    if (!paypal.configured()) return res.status(400).json({ error: 'PayPal is not configured' });
    const quote = await checkout.quoteCart(req.user._id);
    if (!quote) return res.status(400).json({ error: 'Your cart is empty' });

    const reference = `PG-${crypto.randomUUID()}`;
    const order = await paypal.createOrder({ amount: quote.total, currency: paypal.currency(), reference });
    res.json({ id: order.id, total: quote.total });
  })
);

/** POST /api/payments/paypal/capture — capture an approved order, finalize sale. */
router.post(
  '/paypal/capture',
  asyncHandler(async (req, res) => {
    if (!paypal.configured()) return res.status(400).json({ error: 'PayPal is not configured' });
    const { orderID, shippingAddress } = req.body || {};
    if (!orderID) return res.status(400).json({ error: 'orderID is required' });

    const capture = await paypal.captureOrder(orderID);
    if (capture.status !== 'COMPLETED') {
      return res.status(402).json({ error: `Payment not completed (${capture.status})` });
    }

    const order = await checkout.finalizeOrder(
      req.user._id,
      { method: 'paypal', reference: orderID },
      shippingAddress
    );
    res.status(201).json({ order });
  })
);

module.exports = router;
