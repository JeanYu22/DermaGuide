'use strict';

const express = require('express');
const Feedback = require('../models/Feedback');
const Analysis = require('../models/Analysis');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const RATINGS = ['totally-agree', 'partially-agree', 'no-idea', 'partially-disagree', 'totally-disagree'];

/** POST /api/feedback — record a user's rating of an analysis. */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { analysisId, rating, comment } = req.body || {};
    if (!RATINGS.includes(rating)) return res.status(400).json({ error: 'Invalid rating' });

    const analysis = analysisId ? await Analysis.findById(analysisId) : null;

    await Feedback.create({
      analysis: analysis?._id || null,
      user: req.user?._id || null,
      rating,
      comment: comment || '',
    });

    res.status(201).json({ ok: true });
  })
);

module.exports = router;
