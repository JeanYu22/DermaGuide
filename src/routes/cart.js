'use strict';

const express = require('express');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(requireAuth);

/** Serialise a cart with populated product data + totals. */
async function serializeCart(userId) {
  const cart = await Cart.findOne({ user: userId }).populate('items.product');
  const items = (cart?.items || [])
    .filter((i) => i.product) // drop items whose product was removed
    .map((i) => ({
      product: i.product.toStorefront(),
      quantity: i.quantity,
      lineTotal: +(i.product.price * i.quantity).toFixed(2),
    }));
  const subtotal = +items.reduce((sum, i) => sum + i.lineTotal, 0).toFixed(2);
  return { items, subtotal, count: items.reduce((n, i) => n + i.quantity, 0) };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    res.json(await serializeCart(req.user._id));
  })
);

router.post(
  '/items',
  asyncHandler(async (req, res) => {
    const { productId, quantity = 1 } = req.body || {};
    const qty = Math.max(1, parseInt(quantity, 10) || 1);

    const product = await Product.findOne({ _id: productId, active: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const cart = (await Cart.findOne({ user: req.user._id })) || new Cart({ user: req.user._id, items: [] });
    const existing = cart.items.find((i) => i.product.toString() === productId);
    if (existing) existing.quantity += qty;
    else cart.items.push({ product: productId, quantity: qty });
    await cart.save();

    res.status(201).json(await serializeCart(req.user._id));
  })
);

router.patch(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const qty = parseInt(req.body?.quantity, 10);
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) return res.status(404).json({ error: 'Cart is empty' });

    const item = cart.items.find((i) => i.product.toString() === req.params.productId);
    if (!item) return res.status(404).json({ error: 'Item not in cart' });

    if (!qty || qty < 1) cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
    else item.quantity = qty;
    await cart.save();

    res.json(await serializeCart(req.user._id));
  })
);

router.delete(
  '/items/:productId',
  asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id });
    if (cart) {
      cart.items = cart.items.filter((i) => i.product.toString() !== req.params.productId);
      await cart.save();
    }
    res.json(await serializeCart(req.user._id));
  })
);

module.exports = { router, serializeCart };
