'use strict';

const express = require('express');
const Product = require('../models/Product');
const SecurityLog = require('../models/SecurityLog');
const consultant = require('../services/agents/consultant');
const reviewer = require('../services/agents/reviewer');
const security = require('../utils/security');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

/** Match recommended names from the model back to catalogue products. */
function matchProducts(names, products) {
  const out = [];
  for (const name of names) {
    const n = name.toLowerCase();
    const p = products.find(
      (prod) => prod.name.toLowerCase().includes(n) || n.includes(prod.name.toLowerCase())
    );
    if (p && !out.find((x) => x.id === p.id)) out.push(p);
  }
  return out;
}

function parseRecommendLine(text) {
  const m = text.match(/RECOMMEND:\s*(.+)/i);
  if (!m) return [];
  return m[1].split('|').map((s) => s.trim()).filter(Boolean);
}

/**
 * POST /api/chat — streams Lily's reply as Server-Sent Events.
 *
 * Events:
 *   token  { delta }            incremental assistant text
 *   recommendations { products } matched + reviewer-validated products
 *   done   { full }             final cleaned message
 *   error  { message }
 */
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { message, skinContext } = req.body || {};
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message is required' });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

    // 1) Authoritative server-side security gate.
    const threat = security.detectThreat(message);
    if (threat.threat) {
      await SecurityLog.create({
        user: req.user?._id || null,
        ip: req.ip,
        type: threat.type,
        keyword: threat.keyword,
        message: message.slice(0, 200),
      }).catch(() => {});
      const safe = security.safeResponseFor(threat.type);
      send('token', { delta: safe });
      send('done', { full: safe });
      return res.end();
    }

    const products = (await Product.find({ active: true })).map((p) => p.toStorefront());

    try {
      // 2) Stream the consultant agent.
      let full = '';
      for await (const delta of consultant.streamReply({ message, products, skinContext })) {
        full += delta;
        // Hide the machine-readable RECOMMEND: line from the streamed text.
        if (!/RECOMMEND:/i.test(delta)) send('token', { delta });
      }
      full = security.sanitizeReply(full);

      // 3) If products were recommended, run the reviewer cross-check.
      let recommendedNames = parseRecommendLine(full);
      if (recommendedNames.length > 0) {
        try {
          const review = await reviewer.reviewRecommendations({
            userRequest: message,
            consultantReply: full,
            products,
            skinContext,
          });
          if (review.verdict === 'NEEDS_ADJUSTMENT' && review.suggestInstead?.length) {
            recommendedNames = review.suggestInstead;
          }
        } catch (_) {
          /* reviewer is best-effort; fall back to consultant picks */
        }
        const matched = matchProducts(recommendedNames, products);
        if (matched.length) send('recommendations', { products: matched });
      }

      // Strip the RECOMMEND: line from the final visible text.
      const cleaned = full.replace(/RECOMMEND:\s*.+/i, '').trim();
      send('done', { full: cleaned });
      res.end();
    } catch (err) {
      send('error', { message: 'I had trouble responding just now. Please try again.' });
      console.error('chat error:', err.message);
      res.end();
    }
  })
);

module.exports = router;
