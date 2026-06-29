'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const Product = require('../models/Product');
const Order = require('../models/Order');
const Analysis = require('../models/Analysis');
const Feedback = require('../models/Feedback');
const SecurityLog = require('../models/SecurityLog');
const User = require('../models/User');
const productExtractor = require('../services/agents/productExtractor');
const { requireAdmin } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
router.use(requireAdmin);

// Product images are stored on disk under public/uploads/products and served
// statically at /uploads/products/<file>.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'products');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const diskUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = (path.extname(file.originalname) || '.jpg').toLowerCase().replace(/[^.a-z0-9]/g, '');
      cb(null, `${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext || '.jpg'}`);
    },
  }),
  limits: { fileSize: 12 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

const memUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

/** POST /api/admin/uploads — store product images, return their URLs. */
router.post(
  '/uploads',
  diskUpload.array('images', 10),
  asyncHandler(async (req, res) => {
    const urls = (req.files || []).map((f) => `/uploads/products/${f.filename}`);
    res.status(201).json({ urls });
  })
);

/** POST /api/admin/extract — read product info from an image (AI autofill). */
router.post(
  '/extract',
  memUpload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'An image is required' });
    const dataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    const fields = await productExtractor.extract(dataUrl);
    res.json({ fields });
  })
);

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

/** Auto-generate a readable, unique SKU from a product name. */
function generateSku(name) {
  const slug = String(name || 'item')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 14) || 'ITEM';
  return `PG-${slug}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
}

/** POST /api/admin/products — create. SKU is optional (auto-generated if blank). */
router.post(
  '/products',
  asyncHandler(async (req, res) => {
    const body = { ...(req.body || {}) };
    if (!body.sku || !body.sku.trim()) body.sku = generateSku(body.name);
    const product = await Product.create(body);
    res.status(201).json({ product });
  })
);

/** PUT /api/admin/products/:id — update. Blank SKU leaves the existing one untouched. */
router.put(
  '/products/:id',
  asyncHandler(async (req, res) => {
    const body = { ...(req.body || {}) };
    if (!body.sku || !body.sku.trim()) delete body.sku; // don't overwrite with empty
    const product = await Product.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
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
    const supplier = await Supplier.findOne({ key: req.params.key });
    if (!supplier) return res.status(404).json({ error: 'Supplier not found' });

    const body = req.body || {};
    for (const field of ['enabled', 'markup', 'currencyRate', 'maxProducts', 'categoryKeywords', 'name']) {
      if (body[field] !== undefined) supplier[field] = body[field];
    }
    // MERGE config (don't clobber seeded mapping/format/etc. with a partial update).
    if (body.config && typeof body.config === 'object') {
      supplier.config = { ...(supplier.config || {}), ...body.config };
      supplier.markModified('config');
    }
    await supplier.save();
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
