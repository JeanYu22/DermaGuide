'use strict';

const llm = require('../llm');

/**
 * Product recommendation agent.
 *
 * Reasons over the product INGREDIENTS + descriptions against the customer's
 * skin analysis (metrics, concerns, skin type) and picks the best matches with
 * an ingredient-level explanation — rather than naive concern-tag matching.
 *
 * Scales to large catalogues by ranking a pre-retrieved candidate set (the
 * route pre-filters by concern), i.e. retrieve-then-rerank.
 */

function catalogText(products) {
  return products
    .map((p, i) => {
      const ing = (p.keyIngredients || []).join(', ') || 'n/a';
      const concerns = (p.concerns || []).join(', ') || 'general';
      return `${i + 1}. ${p.name} — ${p.desc}. Key ingredients: ${ing}. Good for: ${concerns}. ($${p.price})`;
    })
    .join('\n');
}

function metricsSummary(metrics = {}) {
  return Object.entries(metrics)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1')} ${v}/10`)
    .join(', ') || 'no significant issues';
}

function parsePicks(text, candidates) {
  const out = [];
  for (const raw of String(text || '').split('\n')) {
    const m = raw.replace(/\*\*/g, '').match(/PICK:\s*(.+?)\s*\|\s*(.+)/i);
    if (!m) continue;
    const name = m[1].trim().toLowerCase();
    const reason = m[2].trim();
    const p = candidates.find(
      (c) => c.name.toLowerCase() === name || c.name.toLowerCase().includes(name) || name.includes(c.name.toLowerCase())
    );
    if (p && !out.find((x) => x.id === p.id)) out.push({ ...p, reason });
  }
  return out;
}

/**
 * @param {object} analysis - { bodyPart, skinType, topConcerns, metrics }
 * @param {Array}  candidates - storefront products to choose from
 * @returns {Promise<Array>} chosen products with an AI `reason`
 */
async function recommend(analysis, candidates) {
  if (!candidates || !candidates.length) return [];

  const messages = [
    {
      role: 'system',
      content:
        'You are a knowledgeable, practical skincare advisor. Recommend products by reasoning about their ingredients and how they address the customer\'s specific skin condition. Be concrete and honest — do not over-claim.',
    },
    {
      role: 'user',
      content: `CUSTOMER SKIN ANALYSIS
- Area: ${analysis.bodyPart || 'face'}
- Skin type: ${analysis.skinType || 'normal'}
- Top concerns: ${analysis.topConcerns || 'n/a'}
- Metric scores: ${metricsSummary(analysis.metrics)}

AVAILABLE PRODUCTS:
${catalogText(candidates)}

Pick the 4 to 8 BEST products for THIS customer (more if several genuinely fit, fewer only if the catalogue is small). Base each choice on the product's key ingredients and how they address the customer's highest-scoring concerns and skin type. For each pick, write ONE concise sentence naming the key ingredient(s) and the concern it helps.

Reply with ONE LINE PER PRODUCT, nothing else, using the product names exactly as written above:
PICK: <product name> | <one-sentence ingredient-based reason>`,
    },
  ];

  const text = await llm.chatCompletion(messages, { temperature: 0.3, maxTokens: 700 });
  return parsePicks(text, candidates).slice(0, 10);
}

module.exports = { recommend };
