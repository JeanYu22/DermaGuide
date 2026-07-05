'use strict';

const express = require('express');
const User = require('../models/User');
const { signToken, requireAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body || {};
    if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'Valid email required' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(409).json({ error: 'An account with this email already exists' });

    const user = new User({ email: email.toLowerCase(), name: name || '' });
    await user.setPassword(password);
    await user.save();

    const token = signToken(user);
    res.status(201).json({ token, user: user.toSafeJSON() });
  })
);

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    const user = await User.findOne({ email: (email || '').toLowerCase() });
    if (!user || !(await user.verifyPassword(password || ''))) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    const token = signToken(user);
    res.json({ token, user: user.toSafeJSON() });
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user.toSafeJSON() });
  })
);

// Update profile info + preferences (feeds the recommender for users
// who haven't run a skin analysis).
router.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { name, preferences } = req.body || {};
    if (typeof name === 'string') req.user.name = name.trim().slice(0, 80);
    if (preferences && typeof preferences === 'object') {
      const clean = (arr) => (Array.isArray(arr) ? arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 12) : undefined);
      if (typeof preferences.skinType === 'string') req.user.preferences.skinType = preferences.skinType.trim().toLowerCase().slice(0, 20);
      const concerns = clean(preferences.concerns);
      if (concerns) req.user.preferences.concerns = concerns;
      const categories = clean(preferences.categories);
      if (categories) req.user.preferences.categories = categories;
    }
    await req.user.save();
    res.json({ user: req.user.toSafeJSON() });
  })
);

module.exports = router;
