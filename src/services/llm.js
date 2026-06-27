'use strict';

const config = require('../config');

/**
 * Thin client for the llama.cpp server's OpenAI-compatible API
 * (http://localhost:8080/v1/chat/completions), using the configured model
 * google/gemma-4-E4B-it-qat-q4_0-gguf:Q4_0.
 *
 * Supports:
 *   - chatCompletion(): non-streaming, returns the full assistant string
 *   - streamChatCompletion(): async generator yielding token deltas (SSE)
 *   - Multimodal messages: pass content as an array with image_url parts
 *     (data: URIs) for the skin-analysis agent.
 */

function authHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (config.llama.apiKey) headers.Authorization = `Bearer ${config.llama.apiKey}`;
  return headers;
}

function endpoint() {
  return `${config.llama.baseUrl}/v1/chat/completions`;
}

async function withTimeout(promiseFactory) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llama.timeoutMs);
  try {
    return await promiseFactory(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build a user message. If imageDataUrl is provided, produces the multimodal
 * content-array shape that llama.cpp (with an mmproj projector) understands.
 */
function userMessage(text, imageDataUrl) {
  if (!imageDataUrl) return { role: 'user', content: text };
  return {
    role: 'user',
    content: [
      { type: 'text', text },
      { type: 'image_url', image_url: { url: imageDataUrl } },
    ],
  };
}

/** Non-streaming request that returns the full parsed JSON response. */
async function rawCompletion(messages, options = {}) {
  const body = {
    model: config.llama.model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 768,
    stream: false,
  };

  const res = await withTimeout((signal) =>
    fetch(endpoint(), { method: 'POST', headers: authHeaders(), body: JSON.stringify(body), signal })
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`llama.cpp error ${res.status}: ${detail.slice(0, 300)}`);
  }

  return res.json();
}

async function chatCompletion(messages, options = {}) {
  const data = await rawCompletion(messages, options);
  return data.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * Streaming variant. Yields incremental content deltas as they arrive.
 *
 * Uses an INACTIVITY timeout (reset on every received chunk) rather than a
 * single total-duration cap. This is important for slow CPU vision inference,
 * where image encoding + prefill can take a long time before the first token
 * but tokens then flow steadily — a fixed total timeout would kill a healthy
 * generation mid-stream.
 */
async function* streamChatCompletion(messages, options = {}) {
  const body = {
    model: config.llama.model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 768,
    stream: true,
  };

  const inactivityMs = options.inactivityMs ?? config.llama.timeoutMs;
  const controller = new AbortController();
  let timer;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), inactivityMs);
  };
  arm();

  try {
    const res = await fetch(endpoint(), {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      const detail = res.body ? await res.text().catch(() => '') : '';
      throw new Error(`llama.cpp stream error ${res.status}: ${detail.slice(0, 300)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      arm(); // saw activity → reset the inactivity timer
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch (_) {
          // Ignore keep-alive / partial frames.
        }
      }
    }
  } finally {
    clearTimeout(timer);
  }
}

/** Collect a full streamed completion into a single string. */
async function collectStream(messages, options = {}) {
  let out = '';
  for await (const delta of streamChatCompletion(messages, options)) out += delta;
  return out.trim();
}

/** Health check against the llama.cpp server. */
async function health() {
  try {
    const res = await withTimeout((signal) =>
      fetch(`${config.llama.baseUrl}/health`, { signal })
    );
    return res.ok;
  } catch (_) {
    return false;
  }
}

module.exports = { chatCompletion, rawCompletion, streamChatCompletion, collectStream, userMessage, health };
