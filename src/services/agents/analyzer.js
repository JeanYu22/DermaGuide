'use strict';

const llm = require('../llm');

/**
 * Skin-analysis agent. Reads an uploaded photo (multimodal) and returns the
 * structured 10-metric report used by the radar chart, in the same format the
 * original PureGlow app parsed.
 */

const ANALYSIS_PROMPT = `You are a professional dermatology analysis assistant. Look carefully at the provided skin photo and rate what you actually see.

Reply with ONLY the lines below. Replace every <int> with a real whole number 0-10 based on the photo (0 = none, 10 = severe). Do NOT use markdown, asterisks, brackets, or any extra prose. Do NOT echo the words "0-10" or leave any placeholder.

BODY_PART: <one of face/hand/foot/arm/leg/back>
SKIN_TYPE: <one of dry/normal/oily/combination>
DRYNESS: <int>
DEHYDRATION: <int>
WRINKLES: <int>
SAGGING: <int>
SENSITIVITY: <int>
REDNESS: <int>
BLOCKED_PORES: <int>
ENLARGED_PORES: <int>
ACNE: <int>
PIGMENTATION: <int>
TOP_CONCERNS: <the 3 highest-scoring concerns, comma separated>
RECOMMENDATION: <1-2 sentence professional, non-diagnostic advice>`;

/**
 * @param {string} imageDataUrl - data:image/...;base64,... URI
 * @param {string} [extraInstruction] - optional feedback for re-evaluation
 */
async function analyze(imageDataUrl, extraInstruction = '') {
  const text = extraInstruction ? `${ANALYSIS_PROMPT}\n\n${extraInstruction}` : ANALYSIS_PROMPT;
  const messages = [llm.userMessage(text, imageDataUrl)];
  const raw = await llm.chatCompletion(messages, { temperature: 0.2, maxTokens: 512 });
  // Log the raw model output so vision/format issues are diagnosable from server logs.
  console.log('🔬 analyzer raw output:\n' + (raw || '(empty)').slice(0, 800));
  return raw;
}

/**
 * Re-analyze with user feedback (the "I disagree" loop).
 */
async function reEvaluate(imageDataUrl, originalAnalysis, userFeedback) {
  const instruction = `You previously produced this analysis:\n${originalAnalysis}\n\nThe user disagreed, saying: "${userFeedback}"\n\nCarefully reconsider and produce a REVISED analysis in the same exact format, adjusting metrics to reflect the user's feedback where reasonable.`;
  return analyze(imageDataUrl, instruction);
}

const METRIC_DEFS = [
  ['dryness', 'DRYNESS'],
  ['dehydration', 'DEHYDRATION'],
  ['wrinkles', 'WRINKLES?'],
  ['sagging', 'SAGGING'],
  ['sensitivity', 'SENSITIVITY'],
  ['redness', 'REDNESS'],
  ['blockedPores', 'BLOCKED[ _]?PORES'],
  ['enlargedPores', 'ENLARGED[ _]?PORES'],
  ['acne', 'ACNE'],
  ['pigmentation', 'PIGMENTATION'],
];

/**
 * Parse the structured agent output into a metrics object.
 *
 * Robust to common model quirks:
 *   - Markdown emphasis: "**DRYNESS:** 6", "- DRYNESS: 6"
 *   - Score suffixes: "6/10", "6 out of 10"
 *   - Echoed placeholders: "DRYNESS: [0-10]" (treated as "no score", not 0)
 */
function parse(text) {
  const metrics = {};
  let bodyPart = 'skin';
  let skinType = 'normal';
  let topConcerns = '';
  let recommendation = '';

  const clamp = (v) => Math.max(0, Math.min(10, v));

  // Strip markdown + remove unfilled "[0-10]" / "0-10" placeholders so an
  // echoed template parses as "missing", not as a real 0.
  const clean = String(text || '')
    .replace(/\*\*/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\[?\s*0\s*[-–—]\s*10\s*\]?/g, ' '); // drop the [0-10] scale hint

  let matchedCount = 0;
  for (const [key, pat] of METRIC_DEFS) {
    // LABEL [: = -] <number>, tolerating markdown/spacing already stripped.
    const re = new RegExp(`${pat}\\s*[:=\\-]*\\s*(\\d+(?:\\.\\d+)?)`, 'i');
    const m = clean.match(re);
    if (m) {
      metrics[key] = clamp(parseFloat(m[1]));
      matchedCount += 1;
    } else {
      metrics[key] = 0;
    }
  }

  const grab = (label) => {
    const m = clean.match(new RegExp(`${label}\\s*[:=]\\s*([^\\n]+)`, 'i'));
    return m ? m[1].trim() : '';
  };
  bodyPart = (grab('BODY[ _]?PART').split('/')[0] || bodyPart).trim() || bodyPart;
  skinType = (grab('SKIN[ _]?TYPE').split('/')[0] || skinType).trim() || skinType;
  topConcerns = grab('TOP[ _]?CONCERNS');
  recommendation = grab('RECOMMENDATION');

  // Derive top concerns from the highest metrics if the model omitted/mismatched them.
  const pairs = Object.entries(metrics).sort((a, b) => b[1] - a[1]);
  const computed = pairs
    .filter(([, v]) => v > 0)
    .slice(0, 3)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())} (${v}/10)`)
    .join(', ');
  if (!topConcerns || pairs[0][1] === 0) topConcerns = computed || 'No significant concerns detected';

  // The result is "empty" if the model gave us no usable scores — this lets the
  // route surface a real error instead of a misleading all-zero chart.
  const isEmpty = matchedCount === 0;

  return { bodyPart, skinType, metrics, topConcerns, recommendation, isEmpty, matchedCount, raw: text };
}

module.exports = { analyze, reEvaluate, parse, ANALYSIS_PROMPT };
