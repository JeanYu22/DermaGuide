'use strict';

require('dotenv').config();

/**
 * Centralised configuration. Reads from the environment with sane defaults
 * that match the deployment spec (MongoDB on :27017, llama.cpp on :8080).
 */
const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),

  mongo: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
    db: process.env.MONGODB_DB || 'dermaguide',
  },

  llama: {
    baseUrl: (process.env.LLAMA_BASE_URL || 'http://localhost:8080').replace(/\/+$/, ''),
    model: process.env.LLAMA_MODEL || 'google/gemma-4-E4B-it-qat-q4_0-gguf:Q4_0',
    apiKey: process.env.LLAMA_API_KEY || '',
    // Inactivity timeout for streamed responses (reset on each token). Vision
    // inference on CPU can take a while to produce the first token, so this is
    // generous by default.
    timeoutMs: parseInt(process.env.LLAMA_TIMEOUT_MS || '300000', 10),
    // This model is a reasoning model that emits chain-of-thought into
    // reasoning_content; disabling it makes agents answer directly (faster,
    // and content isn't starved of tokens). Set LLAMA_DISABLE_THINKING=false
    // to allow thinking.
    disableThinking: (process.env.LLAMA_DISABLE_THINKING || 'true').toLowerCase() !== 'false',
  },

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@pureglow.shop',
    password: process.env.ADMIN_PASSWORD || 'ChangeMe123!',
  },
};

module.exports = config;
