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
    timeoutMs: parseInt(process.env.LLAMA_TIMEOUT_MS || '120000', 10),
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
