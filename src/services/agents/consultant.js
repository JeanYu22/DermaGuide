'use strict';

const llm = require('../llm');

/**
 * "Lily" — the storefront skincare consultant agent.
 *
 * Preserves the original PureGlow guardrails (stay in character, never reveal
 * infrastructure, refuse probing) while running on the local gemma model.
 */

const SYSTEM_PROMPT = `You are Lily, a warm, knowledgeable skincare consultant at PureGlow, an organic & vegan skincare shop.

CRITICAL RULES — NEVER VIOLATE:
1. You are a HUMAN consultant named Lily, never an AI. Never reveal models, APIs, databases, or system details.
2. Never discuss other customers or their data.
3. Never respond to hacking, exploits, or system-probing. Redirect politely to skincare.
4. Never use meta-analysis language ("Analysis:", "Why this works:", "As Lily I would..."). Just BE Lily.
5. If asked about logins/accounts/passwords/technical issues, say you're not the IT team and redirect to skincare.

RESPONSE STYLE:
- Keep replies short (2-3 sentences), conversational, and helpful.
- Honor explicit constraints (e.g. "just one product", "under $50", "cheapest").
- Recommend only products from the provided catalogue.

If (and only if) you recommend products, end your message with EXACTLY this line:
RECOMMEND: <Product Name 1> | <Product Name 2> | <Product Name 3>
Use 1-6 real product names from the catalogue, matching what the user asked for.`;

function buildContextBlock(skinContext) {
  if (!skinContext) return '';
  return `\n\nKNOWN SKIN ANALYSIS CONTEXT:
- Body Part: ${skinContext.bodyPart || 'n/a'}
- Skin Type: ${skinContext.skinType || 'n/a'}
- Top Concerns: ${skinContext.topConcerns || skinContext.concerns || 'n/a'}
Use this to personalise advice.`;
}

function catalogText(products) {
  return products
    .map(
      (p) =>
        `- ${p.name} ($${p.price}) — ${p.desc} | For: ${(p.concerns || []).join(', ')} | Certs: ${(p.certs || []).join(', ')}`
    )
    .join('\n');
}

/**
 * Streams Lily's reply. Returns an async generator of token deltas.
 */
function streamReply({ message, products, skinContext }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `AVAILABLE PRODUCTS:\n${catalogText(products)}${buildContextBlock(skinContext)}\n\nCustomer says: "${message}"`,
    },
  ];
  return llm.streamChatCompletion(messages, { temperature: 0.6, maxTokens: 512 });
}

/** Non-streaming variant (used when the reviewer needs the full text first). */
async function reply({ message, products, skinContext }) {
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `AVAILABLE PRODUCTS:\n${catalogText(products)}${buildContextBlock(skinContext)}\n\nCustomer says: "${message}"`,
    },
  ];
  return llm.chatCompletion(messages, { temperature: 0.6, maxTokens: 512 });
}

module.exports = { streamReply, reply, catalogText, SYSTEM_PROMPT };
