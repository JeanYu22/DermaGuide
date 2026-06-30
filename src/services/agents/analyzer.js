'use strict';

const llm = require('../llm');
const { profileFor } = require('../bodyPartProfiles');

/**
 * Skin-analysis agent. Reads an uploaded photo (multimodal) and returns a
 * BODY-PART-SPECIFIC structured report: the metric set adapts to the area
 * (face vs hand vs foot vs back …), and it flags conditions that need a medical
 * professional.
 */

// UPPER_SNAKE label for a camelCase metric key (blockedPores → BLOCKED_PORES).
function keyToLabel(key) {
  return key.replace(/([A-Z])/g, '_$1').toUpperCase();
}
function humanize(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}
function labelMapFromProfile(profile) {
  return Object.fromEntries(profile.metrics.map(([k, l]) => [k, l]));
}

/** Build the analysis prompt for a specific body-part profile. */
function buildPrompt(profile) {
  const metricLines = profile.metrics.map(([k]) => `${keyToLabel(k)}: <int>`).join('\n');
  const metricNames = profile.metrics.map(([, l]) => l).join(', ');
  return `You are a careful dermatology vision assistant examining a photo of a person's ${profile.label.toLowerCase()}.

Score ONLY what is actually visible (0 = none, 3 = mild, 6 = moderate, 9 = severe). These metrics are specific to this body area: ${metricNames}. Do not under-rate clearly visible problems, and do not invent issues on healthy-looking skin.

SAFETY: If you see signs of a SERIOUS skin condition or injury that needs a doctor or dermatologist — for example an open wound, bleeding, signs of infection (pus, spreading redness, swelling), a burn, a suspicious or rapidly changing mole, or a severe/widespread rash — set MEDICAL_FLAG: yes and advise seeing a professional. Otherwise MEDICAL_FLAG: no.

Reply with ONLY the lines below, plain text, no markdown, no brackets, each <int> a whole number 0-10:
BODY_PART: ${profile.label}
SKIN_TYPE: <one of dry/normal/oily/combination>
${metricLines}
TOP_CONCERNS: <the 3 highest-scoring concerns, comma separated>
MEDICAL_FLAG: <yes/no>
MEDICAL_ADVICE: <if yes, one sentence advising professional consultation; else leave blank>
RECOMMENDATION: <1-2 sentence non-diagnostic skincare advice>`;
}

// Focused subject classifier: human/animal/other PLUS the body part, in one
// cheap vision call (so the right metric profile can be chosen before scoring).
const SUBJECT_PROMPT = `Look carefully at this image. Reply with EXACTLY two lines, nothing else:
VERDICT: <human/animal/other>
BODY_PART: <if human, one of face/neck/hand/arm/leg/foot/back/chest; otherwise none>

Rules:
- "human" ONLY if it is clearly a real human person's skin, face, or body part.
- "animal" if it is any non-human animal (monkey, ape, dog, cat, etc.). Look for fur, paw pads, claws, snouts — primate skin resembles human skin, so check for fur and paws.
- "other" if it is not skin at all (object, plant, food, screenshot, drawing, landscape).`;

/**
 * Classify subject + locate body part BEFORE scoring.
 * Returns { verdict, isHuman, bodyPart }.
 */
async function classifySubject(imageDataUrl) {
  const data = await llm.rawCompletion([llm.userMessage(SUBJECT_PROMPT, imageDataUrl)], {
    temperature: 0,
    maxTokens: 40,
  });
  const text = llm.messageText(data).toLowerCase();
  const vm = text.match(/verdict\s*[:=]\s*(human|animal|other)/);
  let verdict;
  if (vm) verdict = vm[1];
  else if (/(animal|monkey|ape|primate|dog|cat|paw|fur|claw|snout)/.test(text)) verdict = 'animal';
  else if (/(object|plant|food|screenshot|drawing|landscape|not skin)/.test(text)) verdict = 'other';
  else verdict = 'human';

  const bpm = text.match(/body[_ ]?part\s*[:=]\s*([a-z ]+)/);
  const bodyPart = bpm ? bpm[1].trim().split(/[\s/]/)[0] : '';

  console.log('🔬 subject classifier:', verdict, '| part:', bodyPart || 'n/a');
  return { verdict, isHuman: verdict === 'human', bodyPart, raw: text };
}

/**
 * @param {string} imageDataUrl - data:image/...;base64,... URI
 * @param {object} profile - body-part profile (from bodyPartProfiles)
 * @param {string} [extraInstruction] - optional feedback for re-evaluation
 */
async function analyze(imageDataUrl, profile, extraInstruction = '') {
  const prompt = extraInstruction ? `${buildPrompt(profile)}\n\n${extraInstruction}` : buildPrompt(profile);
  const messages = [llm.userMessage(prompt, imageDataUrl)];

  const started = Date.now();
  const data = await llm.rawCompletion(messages, { temperature: 0.2, maxTokens: 1024 });
  const raw = llm.messageText(data);
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  if (raw) console.log(`🔬 analyzer (${profile.label}) output in ${secs}s:\n` + raw.slice(0, 800));
  else console.warn(`🔬 analyzer EMPTY response after ${secs}s. finish_reason=` + (data.choices?.[0]?.finish_reason || '?'));
  return raw;
}

/** Re-analyze with user feedback (textual "I disagree" loop). */
async function reEvaluate(imageDataUrl, profile, originalAnalysis, userFeedback) {
  const instruction = `You previously produced this analysis:\n${originalAnalysis}\n\nThe user disagreed, saying: "${userFeedback}"\n\nReconsider carefully and produce a REVISED analysis in the same exact format, adjusting metrics where reasonable.`;
  return analyze(imageDataUrl, profile, instruction);
}

/**
 * Parse the structured agent output using the body-part profile's metric set.
 * Robust to markdown / "x/10" / echoed "[0-10]" placeholders.
 */
function parse(text, profile) {
  profile = profile || profileFor('face');
  const labelMap = labelMapFromProfile(profile);
  const metrics = {};
  let skinType = 'normal';
  let topConcerns = '';
  let recommendation = '';

  const clamp = (v) => Math.max(0, Math.min(10, v));
  const clean = String(text || '')
    .replace(/\*\*/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\[?\s*0\s*[-–—]\s*10\s*\]?/g, ' ');

  // (Human-skin gate is handled by classifySubject; keep a backup check.)
  const skinMatch = clean.match(/IS[_ ]?HUMAN[_ ]?SKIN\s*[:=]\s*(yes|no|true|false)/i);
  const isSkin = skinMatch ? /yes|true/i.test(skinMatch[1]) : true;

  let matchedCount = 0;
  for (const [key] of profile.metrics) {
    const pat = keyToLabel(key).replace(/_/g, '[ _]?');
    const m = clean.match(new RegExp(`${pat}\\s*[:=\\-]*\\s*(\\d+(?:\\.\\d+)?)`, 'i'));
    if (m) { metrics[key] = clamp(parseFloat(m[1])); matchedCount += 1; }
    else metrics[key] = 0;
  }

  const grab = (label) => {
    const m = clean.match(new RegExp(`${label}\\s*[:=]\\s*([^\\n]+)`, 'i'));
    return m ? m[1].trim() : '';
  };
  const bodyPart = (grab('BODY[ _]?PART').split('/')[0] || profile.label).trim() || profile.label;
  skinType = (grab('SKIN[ _]?TYPE').split('/')[0] || skinType).trim() || skinType;
  topConcerns = grab('TOP[ _]?CONCERNS');
  recommendation = grab('RECOMMENDATION');

  const medFlag = grab('MEDICAL[_ ]?FLAG');
  const medicalFlag = /yes|true/i.test(medFlag);
  const medicalAdvice = grab('MEDICAL[_ ]?ADVICE');

  const computed = computeTopConcerns(metrics, labelMap);
  const highest = Math.max(0, ...Object.values(metrics));
  if (!topConcerns || highest === 0) topConcerns = computed || 'No significant concerns detected';

  const isEmpty = matchedCount === 0;

  return {
    bodyPart, skinType, metrics, topConcerns, recommendation,
    medicalFlag, medicalAdvice, isSkin, isEmpty, matchedCount, raw: text,
  };
}

/** Build a "Concern (n/10)" top-3 string from a metrics object. */
function computeTopConcerns(metrics, labelMap = {}) {
  return Object.entries(metrics)
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 0)
    .slice(0, 3)
    .map(([k, v]) => `${labelMap[k] || humanize(k)} (${v}/10)`)
    .join(', ');
}

module.exports = {
  analyze, classifySubject, reEvaluate, parse, computeTopConcerns,
  buildPrompt, labelMapFromProfile,
};
