'use strict';

const express = require('express');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Analysis = require('../models/Analysis');
const Feedback = require('../models/Feedback');
const SecurityLog = require('../models/SecurityLog');
const User = require('../models/User');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(requireAdmin);

/** GET /api/admin/stats — dashboard summary. */
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [products, orders, users, analyses, threats, revenueAgg] = await Promise.all([
      Product.countDocuments(),
      Order.countDocuments(),
      User.countDocuments(),
      Analysis.countDocuments(),
      SecurityLog.countDocuments(),
      Order.aggregate([{ $match: { status: { $in: ['paid', 'shipped', 'delivered'] } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
    ]);
    res.json({
      products,
      orders,
      users,
      analyses,
      threats,
      revenue: +(revenueAgg[0]?.total || 0).toFixed(2),
    });
  })
);

/** GET /api/admin/products — full product docs incl. internal fields. */
router.get(
  '/products',
  asyncHandler(async (_req, res) => {
    const products = await Product.find().sort({ createdAt: 1 });
    res.json({ products });
  })
);

/** POST /api/admin/products — create. */
router.post(
  '/products',
  asyncHandler(async (req, res) => {
    const product = await Product.create(req.body || {});
    res.status(201).json({ product });
  })
);

/** PUT /api/admin/products/:id — update. */
router.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body || {}, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ product });
  })
);

/** DELETE /api/admin/products/:id — soft delete (deactivate). */
router.delete(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const product = await Product.findByIdAndUpdate(req.params.id, { active: false }, { new: true });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json({ ok: true });
  })
);

/** GET /api/admin/orders — all orders. */
router.get(
  '/orders',
  asyncHandler(async (_req, res) => {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(200).populate('user', 'email name');
    res.json({ orders });
  })
);

/** PATCH /api/admin/orders/:id — update status. */
router.patch(
  '/orders/:id',
  asyncHandler(async (req, res) => {
    const order = await Order.findByIdAndUpdate(req.params.id, { status: req.body?.status }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ order });
  })
);

/** GET /api/admin/analyses — recent analyses + feedback rollup. */
router.get(
  '/analyses',
  asyncHandler(async (_req, res) => {
    const analyses = await Analysis.find().sort({ createdAt: -1 }).limit(100);
    res.json({ analyses });
  })
);

/** GET /api/admin/feedback — recent feedback. */
router.get(
  '/feedback',
  asyncHandler(async (_req, res) => {
    const feedback = await Feedback.find().sort({ createdAt: -1 }).limit(100).populate('analysis', 'skinType topConcerns');
    res.json({ feedback });
  })
);

/** GET /api/admin/suppliers — list dropshipping suppliers + adapter status. */
router.get(
  '/suppliers',
  asyncHandler(async (_req, res) => {
    const Supplier = require('../models/Supplier');
    const aliexpress = require('../services/suppliers/aliexpress');
    const suppliers = await Supplier.find().sort({ name: 1 });
    const counts = await Product.aggregate([{ $match: { dropship: true } }, { $group: { _id: '$source', n: { $sum: 1 } } }]);
    const countMap = Object.fromEntries(counts.map((c) => [c._id, c.n]));
    res.json({
      suppliers: suppliers.map((s) => ({
        key: s.key, name: s.name, type: s.type, enabled: s.enabled,
        markup: s.markup, maxProducts: s.maxProducts, config: s.config,
        lastSyncAt: s.lastSyncAt, lastResult: s.lastResult,
        productCount: countMap[s.key] || 0,
        ready: s.type === 'feed' ? Boolean(s.config?.feedUrl || s.config?.feedContent) : aliexpress.configured(),
      })),
    });
  })
);

/** PUT /api/admin/suppliers/:key — update supplier config (markup, feedUrl, enabled, …). */
router.put(
  '/suppliers/:key',
  asyncHandler(async (req, res) => {
    const Supplier = require('../models/Supplier');
    const allowed = (({ enabled, markup, currencyRate, maxProducts, categoryKeywords, config, name }) =>
      ({ enabled, markup, currencyRate, maxProducts, categoryKeywords, config, name }))(req.body || {});
    Object.keys(allowed).forEach((k) => allowed[k] === undefined && delete allowed[k]);
    const supplier = await Supplier.findOneAndUpdate({ key: req.params.key }, allowed, { new: true });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ supplier });
  })
);

/** POST /api/admin/suppliers/:key/sync — pull the supplier's catalogue now. */
router.post(
  '/suppliers/:key/sync',
  asyncHandler(async (req, res) => {
    const Supplier = require('../models/Supplier');
    const { syncSupplier } = require('../services/suppliers');
    const supplier = await Supplier.findOne({ key: req.params.key });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });
    const result = await syncSupplier(supplier);
    res.json({ result });
  })
);

/** GET /api/admin/calibration — learned human-feedback calibration state. */
router.get(
  '/calibration',
  asyncHandler(async (_req, res) => {
    const calibration = require('../services/calibration');
    res.json(await calibration.summary());
  })
);

/** GET /api/admin/security — flagged probing attempts. */
router.get(
  '/security',
  asyncHandler(async (_req, res) => {
    const logs = await SecurityLog.find().sort({ createdAt: -1 }).limit(200);
    res.json({ logs });
  })
);

module.exports = router;
