'use strict';

const { Schema, model } = require('mongoose');

/**
 * A stored skin-analysis record produced by the analyzer + reviewer agents.
 * Images are NOT persisted (privacy); only the derived metrics are kept.
 */
const AnalysisSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },

    bodyPart: { type: String, default: 'skin' },
    skinType: { type: String, default: 'normal' },

    // Displayed (calibrated) metrics.
    metrics: {
      dryness: Number,
      dehydration: Number,
      wrinkles: Number,
      sagging: Number,
      sensitivity: Number,
      redness: Number,
      blockedPores: Number,
      enlargedPores: Number,
      acne: Number,
      pigmentation: Number,
    },

    // Raw model output before calibration — kept so corrections measure the
    // model's true bias (true - model), not the post-calibration value.
    modelMetrics: { type: Schema.Types.Mixed, default: {} },

    topConcerns: { type: String, default: '' },
    recommendation: { type: String, default: '' },

    // ML cross-validation summary from the browser-side TensorFlow pass.
    mlValidation: {
      validated: Boolean,
      confidence: Number,
      faceDetected: Boolean,
    },

    reviewerVerdict: { type: String, default: '' }, // PASS / NEEDS_REVISION
    revised: { type: Boolean, default: false },
    userConfirmed: { type: Boolean, default: false },

    recommendedProducts: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

module.exports = model('Analysis', AnalysisSchema);
