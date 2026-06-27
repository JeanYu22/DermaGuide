'use strict';

const express = require('express');
const multer = require('multer');
const Product = require('../models/Product');
const Analysis = require('../models/Analysis');
const Feedback = require('../models/Feedback');
const analyzer = require('../services/agents/analyzer');
const reviewer = require('../services/agents/reviewer');
const calibration = require('../services/calibration');
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

    // Gate 1: a focused subject classifier (human / animal / other) runs first,
    // because the small grader otherwise rates animal skin as human.
    const subject = await analyzer.classifySubject(dataUrl);
    if (!subject.isHuman) {
      return res.status(422).json({
        code: 'not_human_skin',
        error:
          subject.verdict === 'animal'
            ? 'This looks like an animal, not human skin. Please upload a photo of human skin (face, hand, arm, etc.).'
            : "That photo doesn't look like human skin. Please upload a clear photo of your face, hand, arm, or other skin area.",
      });
    }

    const raw = await analyzer.analyze(dataUrl);
    const parsed = analyzer.parse(raw);

    // Gate 2: the analyzer's own IS_HUMAN_SKIN line, as a backup.
    if (!parsed.isSkin) {
      return res.status(422).json({
        code: 'not_human_skin',
        error:
          "That photo doesn't look like human skin. Please upload a clear photo of your face, hand, arm, or other skin area.",
      });
    }

    // The model returned text we couldn't turn into scores. Surface a real
    // error (with the raw output) instead of a misleading all-zero chart —
    // this usually means the vision projector (--mmproj) isn't loaded or the
    // model ignored the format.
    if (parsed.isEmpty) {
      return res.status(422).json({
        code: 'unreadable',
        error:
          "The AI returned an analysis we couldn't read as scores. If this keeps happening, make sure llama.cpp was started with the multimodal projector (--mmproj) so it can see the photo.",
        raw: raw.slice(0, 600),
      });
    }

    // Apply the learned human-feedback calibration to the raw model scores.
    const modelMetrics = parsed.metrics;
    const offsets = await calibration.getOffsets();
    const metrics = calibration.applyTo(modelMetrics, offsets);
    const topConcerns = analyzer.computeTopConcerns(metrics) || parsed.topConcerns;

    // Peer review (best-effort).
    let reviewerVerdict = 'PASS';
    try {
      const review = await reviewer.reviewAnalysis(raw);
      reviewerVerdict = review.verdict;
    } catch (_) {
      /* ignore reviewer failure */
    }

    const products = (await Product.find({ active: true })).map((p) => p.toStorefront());
    const recommended = recommendFor({ topConcerns }, products);

    // Optional ML cross-validation summary sent from the browser TF pass.
    // Coerce defensively — values may arrive as arrays/typed-arrays from
    // TensorFlow and must not break the save.
    let mlValidation = {};
    try {
      if (req.body.mlValidation) {
        const v = JSON.parse(req.body.mlValidation);
        const num = (x) => {
          if (Array.isArray(x)) x = x[0];
          const n = Number(x);
          return Number.isFinite(n) ? n : 0;
        };
        mlValidation = {
          validated: !!v.validated,
          confidence: num(v.confidence),
          faceDetected: !!v.faceDetected,
        };
      }
    } catch (_) {
      /* ignore malformed ML payload */
    }

    const record = await Analysis.create({
      user: req.user?._id || null,
      bodyPart: parsed.bodyPart,
      skinType: parsed.skinType,
      metrics,
      modelMetrics,
      topConcerns,
      recommendation: parsed.recommendation,
      reviewerVerdict,
      mlValidation,
      recommendedProducts: recommended.map((p) => p.id),
    });

    // Update the user's lightweight skin profile.
    if (req.user) {
      req.user.skinProfile = {
        skinType: parsed.skinType,
        concerns: topConcerns.split(',').map((c) => c.trim()).slice(0, 3),
      };
      await req.user.save().catch(() => {});
    }

    res.status(201).json({
      analysisId: record._id.toString(),
      bodyPart: parsed.bodyPart,
      skinType: parsed.skinType,
      metrics,
      topConcerns,
      recommendation: parsed.recommendation,
      reviewerVerdict,
      recommendedProducts: recommended,
    });
  })
);

/**
 * POST /api/analysis/:id/confirm — user confirms the analysis is accurate.
 * Positive reinforcement signal for the calibration loop.
 */
router.post(
  '/:id/confirm',
  asyncHandler(async (req, res) => {
    const record = await Analysis.findById(req.params.id);
    if (record) {
      record.userConfirmed = true;
      await record.save().catch(() => {});
    }
    await calibration.recordConfirmation();
    await Feedback.create({ analysis: record?._id || null, user: req.user?._id || null, rating: 'totally-agree' }).catch(() => {});
    res.json({ ok: true });
  })
);

/**
 * POST /api/analysis/:id/correct — user provides corrected scores.
 * This is the core human-feedback signal: we learn the model's per-metric bias
 * (true - model) and apply it to future analyses.
 */
router.post(
  '/:id/correct',
  asyncHandler(async (req, res) => {
    const userMetrics = req.body?.metrics || {};
    const record = await Analysis.findById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Analysis not found' });

    // Learn from the delta against the ORIGINAL model output.
    const base = (record.modelMetrics && Object.keys(record.modelMetrics).length ? record.modelMetrics : record.metrics) || {};
    await calibration.recordCorrection(base, userMetrics);

    // Store the user's truth as the displayed metrics.
    const corrected = {};
    for (const m of calibration.METRICS) {
      corrected[m] = Math.max(0, Math.min(10, Math.round(Number(userMetrics[m]) ?? record.metrics[m] ?? 0)));
    }
    record.metrics = corrected;
    record.topConcerns = analyzer.computeTopConcerns(corrected) || record.topConcerns;
    record.revised = true;
    await record.save();

    await Feedback.create({
      analysis: record._id,
      user: req.user?._id || null,
      rating: 'partially-disagree',
      comment: 'user score correction',
    }).catch(() => {});

    const products = (await Product.find({ active: true })).map((p) => p.toStorefront());
    const recommended = recommendFor({ topConcerns: record.topConcerns }, products);

    res.json({
      analysisId: record._id.toString(),
      bodyPart: record.bodyPart,
      skinType: record.skinType,
      metrics: corrected,
      topConcerns: record.topConcerns,
      recommendation: record.recommendation,
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
