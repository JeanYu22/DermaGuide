'use strict';

const { Schema, model } = require('mongoose');

/**
 * Global human-feedback calibration store.
 *
 * For each metric we accumulate the signed error (userTrueValue - modelValue)
 * reported through "Adjust scores" corrections. The learned per-metric offset
 * (mean error, once enough samples exist) is applied to future model outputs —
 * a lightweight online calibration loop driven by reinforcement from human
 * feedback. `stats` is a Mixed map: { acne: { sum, count }, ... }.
 */
const CalibrationSchema = new Schema(
  {
    key: { type: String, default: 'global', unique: true, index: true },
    stats: { type: Schema.Types.Mixed, default: {} },
    corrections: { type: Number, default: 0 }, // total corrections applied
    confirmations: { type: Number, default: 0 }, // total "looks accurate" votes
  },
  { timestamps: true }
);

module.exports = model('Calibration', CalibrationSchema);
