'use strict';

const express = require('express');
const multer = require('multer');
const Product = require('../models/Product');
const Analysis = require('../models/Analysis');
const analyzer = require('../services/agents/analyzer');
const reviewer = require('../services/agents/reviewer');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

// Keep images in memory only — they are sent to the local model and discarded.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, file.mimetype.startsWith('image/')),
});

function toDataUrl(file) {
  return `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
}

/** Pick catalogue products that target the analysis's top concerns. */
function recommendFor(parsed, products) {
  const concernList = parsed.topConcerns.toLowerCase().split(',').map((c) => c.trim());
  let recs = products.filter((p) => p.concerns.some((c) => concernList.some((cc) => cc.includes(c) || c.includes(cc))));
  if (recs.length < 3) recs = products.slice(0, 3);
  return recs.slice(0, 3);
}

/**
 * POST /api/analysis — multipart image upload.
 * Runs analyzer agent → reviewer agent → persists → returns parsed metrics
 * plus recommended products.
 */
router.post(
  '/',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'An image file is required' });

    const dataUrl = toDataUrl(req.file);
    const raw = await analyzer.analyze(dataUrl);
    const parsed = analyzer.parse(raw);

    // The model returned text we couldn't turn into scores. Surface a real
    // error (with the raw output) instead of a misleading all-zero chart —
    // this usually means the vision projector (--mmproj) isn't loaded or the
    // model ignored the format.
    if (parsed.isEmpty) {
      return res.status(422).json({
        error:
          "The AI returned an analysis we couldn't read as scores. If this keeps happening, make sure llama.cpp was started with the multimodal projector (--mmproj) so it can see the photo.",
        raw: raw.slice(0, 600),
      });
    }

    // Peer review (best-effort).
    let reviewerVerdict = 'PASS';
    try {
      const review = await reviewer.reviewAnalysis(raw);
      reviewerVerdict = review.verdict;
    } catch (_) {
      /* ignore reviewer failure */
    }

    const products = (await Product.find({ active: true })).map((p) => p.toStorefront());
    const recommended = recommendFor(parsed, products);

    // Optional ML cross-validation summary sent from the browser TF pass.
    let mlValidation = {};
    try {
      if (req.body.mlValidation) mlValidation = JSON.parse(req.body.mlValidation);
    } catch (_) {
      /* ignore malformed ML payload */
    }

    const record = await Analysis.create({
      user: req.user?._id || null,
      bodyPart: parsed.bodyPart,
      skinType: parsed.skinType,
      metrics: parsed.metrics,
      topConcerns: parsed.topConcerns,
      recommendation: parsed.recommendation,
      reviewerVerdict,
      mlValidation,
      recommendedProducts: recommended.map((p) => p.id),
    });

    // Update the user's lightweight skin profile.
    if (req.user) {
      req.user.skinProfile = {
        skinType: parsed.skinType,
        concerns: parsed.topConcerns.split(',').map((c) => c.trim()).slice(0, 3),
      };
      await req.user.save().catch(() => {});
    }

    res.status(201).json({
      analysisId: record._id.toString(),
      ...parsed,
      reviewerVerdict,
      recommendedProducts: recommended,
    });
  })
);

/**
 * POST /api/analysis/:id/reevaluate — re-run with user feedback.
 * Requires the image again (we never store images).
 */
router.post(
  '/:id/reevaluate',
  upload.single('image'),
  asyncHandler(async (req, res) => {
    const { feedback } = req.body || {};
    if (!req.file) return res.status(400).json({ error: 'Please re-upload the image to re-evaluate' });
    if (!feedback) return res.status(400).json({ error: 'Feedback is required' });

    const record = await Analysis.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Analysis not found' });

    const dataUrl = toDataUrl(req.file);
    const raw = await analyzer.reEvaluate(dataUrl, JSON.stringify(record.metrics), feedback);
    const parsed = analyzer.parse(raw);

    record.metrics = parsed.metrics;
    record.topConcerns = parsed.topConcerns;
    record.recommendation = parsed.recommendation;
    record.skinType = parsed.skinType;
    record.revised = true;
    await record.save();

    const products = (await Product.find({ active: true })).map((p) => p.toStorefront());
    const recommended = recommendFor(parsed, products);

    res.json({ analysisId: record._id.toString(), ...parsed, revised: true, recommendedProducts: recommended });
  })
);

module.exports = router;
