'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { connect } = require('./db/connection');
const { attachUser } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');
const llm = require('./services/llm');

const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(attachUser);

// Rate-limit the AI endpoints to protect the local model from abuse.
const aiLimiter = rateLimit({ windowMs: 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false });

// Health endpoint reports DB + model reachability.
app.get('/api/health', async (_req, res) => {
  const modelOk = await llm.health();
  res.json({
    status: 'ok',
    model: config.llama.model,
    llamaReachable: modelOk,
    time: new Date().toISOString(),
  });
});

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart').router);
app.use('/api/orders', require('./routes/orders'));
app.use('/api/chat', aiLimiter, require('./routes/chat'));
app.use('/api/analysis', aiLimiter, require('./routes/analysis'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/admin', require('./routes/admin'));

// Static frontend
app.use(express.static(path.join(__dirname, '..', 'public')));

// SPA-ish fallback for non-API GET routes.
app.get(/^(?!\/api).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use(errorHandler);

async function start() {
  await connect();
  app.listen(config.port, () => {
    console.log(`🌿 PureGlow / DermaGuide running on http://localhost:${config.port}`);
    console.log(`🤖 LLM: ${config.llama.model} @ ${config.llama.baseUrl}`);
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

module.exports = { app, start };
