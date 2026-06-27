'use strict';

const llm = require('../llm');

/**
 * Peer-review agent. In the original app a second model (GPT-4o) cross-checked
 * the consultant and the analysis. Here we run the SAME local gemma model under
 * a distinct "senior reviewer" persona — preserving the dual-agent
 * cross-validation framework with a single local backend.
 */

/** Review a skin analysis. Returns { verdict, comments, revisedMetrics }. */
async function reviewAnalysis(analysisText) {
  const messages = [
    {
      role: 'system',
      content:
        'You are a senior dermatology reviewer auditing a colleague\'s skin analysis. Be rigorous but fair.',
    },
    {
      role: 'user',
      content: `ANALYSIS TO REVIEW:\n${analysisText}\n\nRespond in EXACTLY this format:\nVALIDATION: [PASS/NEEDS_REVISION]\nCOMMENTS: [one short line]\nIf any metric is unrealistic, add lines like:\nREVISED_DRYNESS: [0-10]\nREVISED_RECOMMENDATION: [text]`,
    },
  ];

  const text = await llm.chatCompletion(messages, { temperature: 0.2, maxTokens: 256 });
  const lower = text.toLowerCase();
  const verdict = lower.includes('needs_revision') ? 'NEEDS_REVISION' : 'PASS';

  const revisedMetrics = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^REVISED_([A-Z_]+):\s*(.+)$/i);
    if (m) revisedMetrics[m[1].toLowerCase()] = m[2].trim();
  }
  const comments = (text.match(/COMMENTS:\s*(.+)/i)?.[1] || '').trim();

  return { verdict, comments, revisedMetrics, raw: text };
}

/**
 * Review product recommendations against the user's request.
 * Returns { verdict, suggestInstead: string[] | null }.
 */
async function reviewRecommendations({ userRequest, consultantReply, products, skinContext }) {
  const catalog = products.map((p) => `${p.name} ($${p.price}) — for ${(p.concerns || []).join(', ')}`).join('\n');
  const ctx = skinContext
    ? `\nSKIN CONTEXT: ${skinContext.skinType || ''} | concerns: ${skinContext.topConcerns || skinContext.concerns || ''}`
    : '';

  const messages = [
    { role: 'system', content: 'You are a senior skincare consultant validating a colleague\'s product picks.' },
    {
      role: 'user',
      content: `USER REQUEST: "${userRequest}"\n\nCOLLEAGUE'S REPLY:\n${consultantReply}\n${ctx}\n\nCATALOGUE:\n${catalog}\n\nVerify the picks match the request (quantity, budget, concerns) and the catalogue.\nRespond EXACTLY:\nVALIDATION: [PASS/NEEDS_ADJUSTMENT]\nIf adjustment needed, add:\nSUGGEST_INSTEAD: <Name 1> | <Name 2> | <Name 3>`,
    },
  ];

  const text = await llm.chatCompletion(messages, { temperature: 0.3, maxTokens: 200 });
  const suggestMatch = text.match(/SUGGEST_INSTEAD:\s*(.+)/i);
  const suggestInstead = suggestMatch
    ? suggestMatch[1].split('|').map((s) => s.trim()).filter(Boolean)
    : null;
  const verdict = /needs_adjustment/i.test(text) ? 'NEEDS_ADJUSTMENT' : 'PASS';

  return { verdict, suggestInstead, raw: text };
}

module.exports = { reviewAnalysis, reviewRecommendations };
