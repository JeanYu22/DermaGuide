'use strict';

const llm = require('../llm');

/**
 * Skin-analysis agent. Reads an uploaded photo (multimodal) and returns the
 * structured 10-metric report used by the radar chart, in the same format the
 * original PureGlow app parsed.
 */

const ANALYSIS_PROMPT = `You are a careful dermatology vision assistant.

STEP 1 — Decide if the photo actually shows HUMAN SKIN (a real human face or body part). If it does NOT (an object, animal, food, screenshot, drawing, landscape, blank/blurry image, etc.), reply with EXACTLY this single line and nothing else:
IS_HUMAN_SKIN: no

STEP 2 — If it IS human skin, score what is actually visible using this guide (0 = none, 3 = mild, 6 = moderate, 9 = severe):
- ACNE: count visible pimples, pustules, papules and comedones. A few small spots = 2-3; many inflamed lesions across a cheek/region = 7-9. Do NOT underrate clearly visible acne.
- REDNESS: visible erythema / inflammation; calm even tone = 0-2.
- BLOCKED_PORES / ENLARGED_PORES: only when pores are clearly congested or visibly large; smooth skin = 0-2. Do NOT inflate pore scores when skin looks smooth.
- DRYNESS / DEHYDRATION: flaking, tightness, dull rough texture.
- WRINKLES / SAGGING: only for visible lines or laxity.
- PIGMENTATION: dark spots, uneven tone, post-acne marks.

Reply with ONLY the lines below, plain text, no markdown, no brackets, each <int> a whole number 0-10:
IS_HUMAN_SKIN: yes
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

// Focused subject classifier. A weak grader buries the human/animal decision
// when it's also asked to score 10 metrics, so we ask ONLY this question first.
const SUBJECT_PROMPT = `Look carefully at this image and decide what it shows. Reply with EXACTLY one line, nothing else:
VERDICT: human
VERDICT: animal
VERDICT: other

Use these rules:
- "human" ONLY if it is clearly a real human person's skin, face, or body part.
- "animal" if it is any non-human animal (monkey, ape, dog, cat, rodent, etc.). Look hard for fur, paw pads, claws, snouts, or animal anatomy — primate/monkey skin looks similar to human skin, so check for fur and paws.
- "other" if it is not skin at all (object, plant, food, screenshot, drawing, landscape).`;

/**
 * Classify the photo's subject BEFORE scoring. Returns { verdict, isHuman }.
 * Defaults to human only when genuinely ambiguous, to avoid rejecting real
 * human photos.
 */
async function classifySubject(imageDataUrl) {
  const data = await llm.rawCompletion([llm.userMessage(SUBJECT_PROMPT, imageDataUrl)], {
    temperature: 0,
    maxTokens: 24,
  });
  const text = llm.messageText(data).toLowerCase();
  const m = text.match(/verdict\s*[:=]\s*(human|animal|other)/);
  let verdict;
  if (m) verdict = m[1];
  else if (/(animal|monkey|ape|primate|dog|cat|paw|fur|claw|snout)/.test(text)) verdict = 'animal';
  else if (/(object|plant|food|screenshot|drawing|landscape|not skin)/.test(text)) verdict = 'other';
  else verdict = 'human';
  console.log('🔬 subject classifier:', verdict, '|', text.slice(0, 120));
  return { verdict, isHuman: verdict === 'human', raw: text };
}

/**
 * @param {string} imageDataUrl - data:image/...;base64,... URI
 * @param {string} [extraInstruction] - optional feedback for re-evaluation
 */
async function analyze(imageDataUrl, extraInstruction = '') {
  const text = extraInstruction ? `${ANALYSIS_PROMPT}\n\n${extraInstruction}` : ANALYSIS_PROMPT;
  const messages = [llm.userMessage(text, imageDataUrl)];

  // Thinking is disabled globally for this reasoning model, so the answer lands
  // in content directly. Generous token budget + reasoning_content fallback in
  // case a build ignores the hint and still thinks.
  const started = Date.now();
  const data = await llm.rawCompletion(messages, { temperature: 0.2, maxTokens: 1024 });
  const raw = llm.messageText(data);
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  if (raw) {
    console.log(`🔬 analyzer output in ${secs}s:\n` + raw.slice(0, 800));
  } else {
    console.warn(`🔬 analyzer EMPTY response after ${secs}s. finish_reason=` + (data.choices?.[0]?.finish_reason || '?'));
  }
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

  // Human-skin gate: the model answers IS_HUMAN_SKIN: yes/no first.
  const skinMatch = clean.match(/IS[_ ]?HUMAN[_ ]?SKIN\s*[:=]\s*(yes|no|true|false)/i);
  const isSkin = skinMatch ? /yes|true/i.test(skinMatch[1]) : true;

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
  const computed = computeTopConcerns(metrics);
  const highest = Math.max(...Object.values(metrics));
  if (!topConcerns || highest === 0) topConcerns = computed || 'No significant concerns detected';

  // The result is "empty" if the model gave us no usable scores — this lets the
  // route surface a real error instead of a misleading all-zero chart.
  const isEmpty = matchedCount === 0;

  return { bodyPart, skinType, metrics, topConcerns, recommendation, isSkin, isEmpty, matchedCount, raw: text };
}

/** Build a "Concern (n/10)" top-3 string from a metrics object. */
function computeTopConcerns(metrics) {
  return Object.entries(metrics)
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 0)
    .slice(0, 3)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())} (${v}/10)`)
    .join(', ');
}

module.exports = { analyze, classifySubject, reEvaluate, parse, computeTopConcerns, ANALYSIS_PROMPT };
