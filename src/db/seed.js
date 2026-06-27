'use strict';

const { connect, disconnect } = require('./connection');
const Product = require('../models/Product');
const User = require('../models/User');
const config = require('../config');

/** The original PureGlow catalogue, mapped to the commerce Product schema. */
const PRODUCTS = [
  {
    sku: 'PG-HSERUM-01', name: 'Hydrating Serum', desc: 'Hyaluronic acid + Vitamin E', price: 49.99, emoji: '💧',
    certs: ['organic', 'vegan', 'cruelty-free'], concerns: ['dryness', 'dehydration', 'fine lines', 'dry'],
    types: ['dry', 'normal', 'combination'], stock: 50, cost: 18.5, expiryDate: '2026-12-31', supplier: 'GreenLab Cosmetics',
  },
  {
    sku: 'PG-CLEANSE-02', name: 'Gentle Cleanser', desc: 'Aloe & chamomile blend', price: 29.99, emoji: '🧴',
    certs: ['organic', 'vegan'], concerns: ['sensitivity', 'redness', 'irritation', 'sensitive'],
    types: ['sensitive', 'dry', 'normal'], stock: 35, cost: 9.75, expiryDate: '2026-10-15', supplier: 'PureNature Ltd',
  },
  {
    sku: 'PG-VITC-03', name: 'Vitamin C Cream', desc: 'Brightening & anti-aging', price: 59.99, emoji: '✨',
    certs: ['organic', 'vegan', 'cruelty-free'], concerns: ['dark spots', 'dullness', 'uneven tone', 'aging', 'pigmentation'],
    types: ['all'], stock: 42, cost: 22.0, expiryDate: '2027-03-20', supplier: 'VitaSkin Corp',
  },
  {
    sku: 'PG-CLAY-04', name: 'Clay Mask', desc: 'Deep pore cleansing', price: 34.99, emoji: '🎭',
    certs: ['organic', 'vegan', 'cruelty-free'], concerns: ['acne', 'blackheads', 'oily', 'large pores'],
    types: ['oily', 'combination'], stock: 28, cost: 11.25, expiryDate: '2026-08-30', supplier: 'EarthClay Supplies',
  },
  {
    sku: 'PG-NIGHT-05', name: 'Night Cream', desc: 'Bakuchiol & peptides', price: 69.99, emoji: '🌙',
    certs: ['organic', 'vegan', 'cruelty-free'], concerns: ['wrinkles', 'aging', 'firmness', 'fine lines'],
    types: ['mature', 'dry', 'normal'], stock: 18, cost: 27.5, expiryDate: '2027-01-10', supplier: 'NightGlow Inc',
  },
  {
    sku: 'PG-OIL-06', name: 'Face Oil', desc: 'Jojoba, argan & rosehip', price: 44.99, emoji: '🌰',
    certs: ['organic', 'vegan'], concerns: ['dryness', 'sensitivity', 'redness', 'dry'],
    types: ['dry', 'normal', 'sensitive'], stock: 60, cost: 16.0, expiryDate: '2027-06-25', supplier: 'Organic Oils Co',
  },
];

async function seed() {
  await connect();

  for (const p of PRODUCTS) {
    await Product.updateOne({ sku: p.sku }, { $set: p }, { upsert: true });
  }
  console.log(`✅ Seeded ${PRODUCTS.length} products`);

  // Bootstrap an admin account.
  const existingAdmin = await User.findOne({ email: config.admin.email.toLowerCase() });
  if (!existingAdmin) {
    const admin = new User({ email: config.admin.email.toLowerCase(), name: 'PureGlow Admin', role: 'admin' });
    await admin.setPassword(config.admin.password);
    await admin.save();
    console.log(`✅ Created admin user: ${config.admin.email}`);
  } else {
    console.log(`ℹ️  Admin user already exists: ${config.admin.email}`);
  }

  await disconnect();
  console.log('🌱 Seed complete.');
}

if (require.main === module) {
  seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

module.exports = { seed, PRODUCTS };
