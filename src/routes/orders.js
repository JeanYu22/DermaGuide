'use strict';

const express = require('express');
const crypto = require('crypto');
const Cart = require('../models/Cart');
const Order = require('../models/Order');
const Product = require('../models/Product');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(requireAuth);

const TAX_RATE = 0.08;
const FREE_SHIPPING_THRESHOLD = 50;
const SHIPPING_FEE = 5.99;

/** POST /api/orders/checkout — turn the cart into a (mock-paid) order. */
router.post(
  '/checkout',
  asyncHandler(async (req, res) => {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    const items = (cart?.items || []).filter((i) => i.product);
    if (items.length === 0) return res.status(400).json({ error: 'Your cart is empty' });

    // Verify stock and build order line items from authoritative DB prices.
    for (const i of items) {
      if (i.product.stock < i.quantity) {
        return res.status(409).json({ error: `Not enough stock for ${i.product.name}` });
      }
    }

    const orderItems = items.map((i) => ({
      product: i.product._id,
      name: i.product.name,
      sku: i.product.sku,
      price: i.product.price,
      quantity: i.quantity,
    }));

    const subtotal = +orderItems.reduce((s, i) => s + i.price * i.quantity, 0).toFixed(2);
    const tax = +(subtotal * TAX_RATE).toFixed(2);
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    const total = +(subtotal + tax + shipping).toFixed(2);

    const order = await Order.create({
      user: req.user._id,
      items: orderItems,
      subtotal,
      tax,
      shipping,
      total,
      status: 'paid',
      shippingAddress: req.body?.shippingAddress || {},
      payment: { method: 'mock', reference: `MOCK-${crypto.randomUUID()}`, paidAt: new Date() },
    });

    // Decrement stock and clear the cart.
    await Promise.all(
      items.map((i) => Product.updateOne({ _id: i.product._id }, { $inc: { stock: -i.quantity } }))
    );
    cart.items = [];
    await cart.save();

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
