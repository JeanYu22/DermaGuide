'use strict';

const Calibration = require('../models/Calibration');

/**
 * Human-feedback calibration service.
 *
 * Learns a per-metric correction offset from user "Adjust scores" corrections
 * and applies it to future model outputs. This is the practical, local-model
 * equivalent of reinforcement-from-human-feedback: we can't retrain the GGUF
 * weights, but we continuously correct their systematic bias from real votes.
 */

const METRICS = [
  'dryness', 'dehydration', 'wrinkles', 'sagging', 'sensitivity',
  'redness', 'blockedPores', 'enlargedPores', 'acne', 'pigmentation',
];

const MIN_SAMPLES = 3; // need a few corrections before trusting an offset
const MAX_OFFSET = 4; // clamp learned correction to keep it sane

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

async function getDoc() {
  return Calibration.findOneAndUpdate(
    { key: 'global' },
    { $setOnInsert: { key: 'global', stats: {} } },
    { upsert: true, new: true }
  );
}

/** Current learned offsets per metric (0 until enough samples exist). */
async function getOffsets() {
  const doc = await getDoc();
  const offsets = {};
  for (const m of METRICS) {
    const s = doc.stats?.[m];
    offsets[m] = s && s.count >= MIN_SAMPLES ? clamp(s.sum / s.count, -MAX_OFFSET, MAX_OFFSET) : 0;
  }
  return offsets;
}

/** Apply offsets to a metrics object, returning calibrated (clamped 0-10) values. */
function applyTo(metrics, offsets) {
  const out = {};
  for (const m of METRICS) {
    const base = Number(metrics[m]) || 0;
    const adj = offsets[m] || 0;
    out[m] = clamp(Math.round(base + adj), 0, 10);
  }
  return out;
}

/**
 * Record a user correction: accumulate (trueValue - modelValue) per metric.
 * @param {object} modelMetrics - the model's original (pre-calibration) scores
 * @param {object} userMetrics  - the user's corrected scores
 */
async function recordCorrection(modelMetrics, userMetrics) {
  const doc = await getDoc();
  const stats = doc.stats || {};
  for (const m of METRICS) {
    if (userMetrics[m] === undefined || userMetrics[m] === null) continue;
    const model = Number(modelMetrics?.[m]) || 0;
    const truth = clamp(Number(userMetrics[m]) || 0, 0, 10);
    const cur = stats[m] || { sum: 0, count: 0 };
    cur.sum += truth - model;
    cur.count += 1;
    stats[m] = cur;
  }
  doc.stats = stats;
  doc.corrections += 1;
  doc.markModified('stats');
  await doc.save();
  return doc;
}

/** Record a positive confirmation ("looks accurate"). */
async function recordConfirmation() {
  const doc = await getDoc();
  doc.confirmations += 1;
  await doc.save();
  return doc;
}

/** Summary for the admin dashboard. */
async function summary() {
  const doc = await getDoc();
  const offsets = await getOffsets();
  const perMetric = METRICS.map((m) => ({
    metric: m,
    samples: doc.stats?.[m]?.count || 0,
    offset: +(offsets[m] || 0).toFixed(2),
  }));
  return { corrections: doc.corrections, confirmations: doc.confirmations, perMetric };
}

module.exports = { METRICS, getOffsets, applyTo, recordCorrection, recordConfirmation, summary };
