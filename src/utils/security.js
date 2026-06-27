'use strict';

/**
 * Server-side prompt-injection / probing detector. Mirrors the original
 * client-side guard but runs authoritatively on the backend so it cannot be
 * bypassed by editing the page.
 */
const THREATS = {
  system_info: ['what model', 'which ai', 'are you ai', 'are you a bot', 'gpt', 'chatgpt', 'gemma', 'llama', 'llm', 'ml model', 'which model', 'system prompt', 'api key', 'backend', 'database', 'mongodb', 'system architecture', 'tech stack'],
  privacy: ['other user', 'customer data', 'user list', 'who else', 'other customer', 'previous customer', 'user information', 'everyone who'],
  hacking: ['sql injection', 'xss', 'bypass', 'admin password', 'backdoor', 'vulnerability', 'penetration test', 'source code', 'credentials', 'ignore previous', 'ignore your instructions', 'reveal your prompt'],
};

const SAFE_RESPONSES = {
  system_info:
    "I appreciate your curiosity! I can't get into the technical side of things — I'm here for your skincare needs. What concerns can I help with today? 🌿",
  privacy:
    "I always protect every customer's privacy, so I can't share anything about other people. How can I help with YOUR skincare instead? 😊",
  hacking:
    "⚠️ That request looks unusual, so I won't be able to help with it. But if you have any skincare questions, I'm all ears!",
};

/** Returns { threat, type, keyword } for a message. */
function detectThreat(message) {
  const lower = String(message || '').toLowerCase();
  for (const [type, keywords] of Object.entries(THREATS)) {
    for (const keyword of keywords) {
      if (lower.includes(keyword)) return { threat: true, type, keyword };
    }
  }
  return { threat: false };
}

function safeResponseFor(type) {
  return SAFE_RESPONSES[type] || SAFE_RESPONSES.system_info;
}

/**
 * Strip any meta-analysis / fourth-wall-breaking language the model might leak,
 * so Lily always stays in character.
 */
function sanitizeReply(text) {
  let out = String(text || '');
  const patterns = [
    /\*\*Analysis:\*\*/gi,
    /\*\*Why this works:\*\*/gi,
    /As Lily[, ].*?:/gi,
    /As an AI[^.]*\.?/gi,
    /I am an AI[^.]*\.?/gi,
    /language model/gi,
  ];
  for (const p of patterns) out = out.replace(p, '');
  return out.trim();
}

module.exports = { detectThreat, safeResponseFor, sanitizeReply };
