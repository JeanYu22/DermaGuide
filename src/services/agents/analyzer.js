'use strict';

const llm = require('../llm');

/**
 * Skin-analysis agent. Reads an uploaded photo (multimodal) and returns the
 * structured 10-metric report used by the radar chart, in the same format the
 * original PureGlow app parsed.
 */

const ANALYSIS_PROMPT = `You are a professional dermatology analysis assistant. Analyze the provided skin photo and respond in this EXACT format (no extra prose):

BODY_PART: [face/hand/foot/arm/leg/back/etc]
SKIN_TYPE: [dry/normal/oily/combination]

METRICS (rate each 0-10, where 0=none, 10=severe):
DRYNESS: [0-10]
DEHYDRATION: [0-10]
WRINKLES: [0-10]
SAGGING: [0-10]
SENSITIVITY: [0-10]
REDNESS: [0-10]
BLOCKED_PORES: [0-10]
ENLARGED_PORES: [0-10]
ACNE: [0-10]
PIGMENTATION: [0-10]

TOP_CONCERNS: [the 3 highest-scoring concerns]
RECOMMENDATION: [1-2 sentence professional, non-diagnostic advice]

Be precise and base scores on visible skin conditions only.`;

/**
 * @param {string} imageDataUrl - data:image/...;base64,... URI
 * @param {string} [extraInstruction] - optional feedback for re-evaluation
 */
async function analyze(imageDataUrl, extraInstruction = '') {
  const text = extraInstruction ? `${ANALYSIS_PROMPT}\n\n${extraInstruction}` : ANALYSIS_PROMPT;
  const messages = [llm.userMessage(text, imageDataUrl)];
  return llm.chatCompletion(messages, { temperature: 0.2, maxTokens: 512 });
}

/**
 * Re-analyze with user feedback (the "I disagree" loop).
 */
async function reEvaluate(imageDataUrl, originalAnalysis, userFeedback) {
  const instruction = `You previously produced this analysis:\n${originalAnalysis}\n\nThe user disagreed, saying: "${userFeedback}"\n\nCarefully reconsider and produce a REVISED analysis in the same exact format, adjusting metrics to reflect the user's feedback where reasonable.`;
  return analyze(imageDataUrl, instruction);
}

/** Parse the structured agent output into a metrics object. */
function parse(text) {
  const metrics = {};
  let bodyPart = 'skin';
  let skinType = 'normal';
  let topConcerns = '';
  let recommendation = '';

  const clamp = (v) => Math.max(0, Math.min(10, v));
  const num = (line) => {
    const m = (line.split(':')[1] || '').match(/(\d+\.?\d*)/);
    return m ? clamp(parseFloat(m[1])) : 0;
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const U = line.toUpperCase();
    if (U.startsWith('BODY_PART:') || U.startsWith('BODYPART:')) bodyPart = line.split(':')[1]?.trim() || bodyPart;
    else if (U.startsWith('SKIN_TYPE:') || U.startsWith('SKINTYPE:')) skinType = line.split(':')[1]?.trim() || skinType;
    else if (U.startsWith('DRYNESS:')) metrics.dryness = num(line);
    else if (U.startsWith('DEHYDRATION:')) metrics.dehydration = num(line);
    else if (U.startsWith('WRINKLE')) metrics.wrinkles = num(line);
    else if (U.startsWith('SAGGING:')) metrics.sagging = num(line);
    else if (U.startsWith('SENSITIV')) metrics.sensitivity = num(line);
    else if (U.startsWith('REDNESS:')) metrics.redness = num(line);
    else if (U.startsWith('BLOCKED_PORES:') || U.startsWith('BLOCKEDPORES:')) metrics.blockedPores = num(line);
    else if (U.startsWith('ENLARGED_PORES:') || U.startsWith('ENLARGEDPORES:')) metrics.enlargedPores = num(line);
    else if (U.startsWith('ACNE:')) metrics.acne = num(line);
    else if (U.startsWith('PIGMENTATION:')) metrics.pigmentation = num(line);
    else if (U.startsWith('TOP_CONCERNS:') || U.startsWith('TOPCONCERNS:')) topConcerns = line.split(':')[1]?.trim() || '';
    else if (U.startsWith('RECOMMENDATION:')) recommendation = line.split(':')[1]?.trim() || '';
  }

  const required = ['dryness', 'dehydration', 'wrinkles', 'sagging', 'sensitivity', 'redness', 'blockedPores', 'enlargedPores', 'acne', 'pigmentation'];
  for (const k of required) if (metrics[k] === undefined || Number.isNaN(metrics[k])) metrics[k] = 0;

  // Derive top concerns from the highest metrics if the model omitted/mismatched them.
  const pairs = Object.entries(metrics).sort((a, b) => b[1] - a[1]);
  const computed = pairs
    .filter(([, v]) => v > 0)
    .slice(0, 3)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())} (${v}/10)`)
    .join(', ');
  if (!topConcerns || pairs[0][1] === 0) topConcerns = computed || 'No significant concerns detected';

  return { bodyPart, skinType, metrics, topConcerns, recommendation, raw: text };
}

module.exports = { analyze, reEvaluate, parse, ANALYSIS_PROMPT };
