'use strict';

const llm = require('../llm');

/**
 * Product-info extraction agent. Reads a product photo (label, packaging, or
 * spec sheet) and pulls out structured fields to pre-fill the admin form.
 */

const EXTRACT_PROMPT = `You are reading a skincare product image (its label, box, or spec sheet). Extract any product information you can actually read in the image.

Reply with ONLY the lines below, plain text, no markdown. Leave a field BLANK after the colon if it is not visible. Do not invent information.

NAME: <product name>
BRAND: <brand name>
DESCRIPTION: <one short sentence describing the product>
PRICE: <number only, if a price is shown, else blank>
KEY_INGREDIENTS: <comma-separated active ingredients>
CERTIFICATIONS: <comma-separated, only from: organic, vegan, cruelty-free>
HOW_TO_USE: <application instructions if shown>
CONCERNS: <comma-separated skin concerns it targets, e.g. acne, dryness, redness, pigmentation, wrinkles>`;

function parseExtraction(text) {
  const clean = String(text || '').replace(/\*\*/g, '').replace(/[*`#>]/g, '');
  const grab = (label) => {
    const m = clean.match(new RegExp(`${label}\\s*[:=]\\s*([^\\n]*)`, 'i'));
    const v = m ? m[1].trim() : '';
    // Treat echoed placeholders / "n/a" as blank.
    return /^(<.*>|n\/?a|none|blank|-|unknown)?$/i.test(v) ? '' : v;
  };
  const list = (label) =>
    grab(label).split(/[,;]/).map((s) => s.trim().toLowerCase()).filter(Boolean);

  const priceRaw = grab('PRICE').match(/(\d+(?:\.\d+)?)/);

  // Only keep certs we recognise.
  const certs = list('CERTIFICATIONS')
    .map((c) => c.replace(/\s+/g, '-'))
    .filter((c) => ['organic', 'vegan', 'cruelty-free'].includes(c));

  return {
    name: grab('NAME'),
    brand: grab('BRAND'),
    desc: grab('DESCRIPTION'),
    price: priceRaw ? parseFloat(priceRaw[1]) : null,
    keyIngredients: list('KEY_INGREDIENTS'),
    certs,
    howToUse: grab('HOW_TO_USE'),
    concerns: list('CONCERNS'),
    raw: text,
  };
}

/** @param {string} imageDataUrl - data:image/...;base64,... */
async function extract(imageDataUrl) {
  const data = await llm.rawCompletion([llm.userMessage(EXTRACT_PROMPT, imageDataUrl)], {
    temperature: 0.1,
    maxTokens: 512,
  });
  const raw = llm.messageText(data);
  return parseExtraction(raw);
}

module.exports = { extract, parseExtraction, EXTRACT_PROMPT };
