'use strict';

const { connect, disconnect } = require('./connection');
const Product = require('../models/Product');
const User = require('../models/User');
const Supplier = require('../models/Supplier');
const config = require('../config');

/** Default dropshipping supplier configs (disabled until configured). */
const SUPPLIERS = [
  {
    key: 'aliexpress', name: 'AliExpress Dropshipping', type: 'api', enabled: false, markup: 2.5,
    currencyRate: 1.08, // EUR → USD for stored cost
    config: {
      searchKeywords: ['organic skincare', 'certified organic face cream', 'natural vegan serum', 'organic moisturizer', 'EU organic skincare'],
      currency: 'EUR',
      priceMin: 1,
      priceMax: 10,
      moq: 1,
      sort: 'orders_desc', // hot-selling first
      // Ship-from EU member states (applied when the API returns origin data).
      shipFrom: ['ES', 'FR', 'DE', 'IT', 'PL', 'NL', 'BE', 'PT', 'AT', 'SE', 'DK', 'FI', 'IE', 'CZ', 'GR', 'RO', 'HU'],
      shipTo: 'DE',
    },
  },
  {
    key: 'spocket', name: 'Spocket', type: 'feed', enabled: false, markup: 2.2,
    config: {
      feedUrl: '',
      format: 'csv',
      mapping: { externalId: 'id', title: 'title', description: 'description', price: 'price', image: 'image', url: 'url', brand: 'brand', stock: 'inventory' },
    },
  },
  {
    key: 'beautyjoint', name: 'BeautyJoint', type: 'feed', enabled: false, markup: 2.0,
    config: {
      feedUrl: '',
      format: 'csv',
      mapping: { externalId: 'sku', title: 'name', description: 'description', price: 'wholesale_price', image: 'image_url', url: 'product_url', brand: 'brand', stock: 'qty' },
    },
  },
];

/** The original PureGlow catalogue, mapped to the commerce Product schema. */
const PRODUCTS = [
  {
    sku: 'PG-HSERUM-01', name: 'Hydrating Serum', desc: 'Hyaluronic acid + Vitamin E', price: 49.99, emoji: '💧',
    certs: ['organic', 'vegan', 'cruelty-free'], concerns: ['dryness', 'dehydration', 'fine lines', 'dry'],
    types: ['dry', 'normal', 'combination'], stock: 50, cost: 18.5, expiryDate: '2026-12-31', supplier: 'GreenLab Cosmetics',
    keyIngredients: ['Hyaluronic Acid', 'Vitamin E'],
    howToUse: 'Apply 2-3 drops to clean, damp skin morning and night, before your moisturizer.',
  },
  {
    sku: 'PG-CLEANSE-02', name: 'Gentle Cleanser', desc: 'Aloe & chamomile blend', price: 29.99, emoji: '🧴',
    certs: ['organic', 'vegan'], concerns: ['sensitivity', 'redness', 'irritation', 'sensitive'],
    types: ['sensitive', 'dry', 'normal'], stock: 35, cost: 9.75, expiryDate: '2026-10-15', supplier: 'PureNature Ltd',
    keyIngredients: ['Aloe Vera', 'Chamomile'],
    howToUse: 'Massage a small amount onto damp skin, then rinse with lukewarm water. Use morning and evening.',
  },
  {
    sku: 'PG-VITC-03', name: 'Vitamin C Cream', desc: 'Brightening & anti-aging', price: 59.99, emoji: '✨',
    certs: ['organic', 'vegan', 'cruelty-free'], concerns: ['dark spots', 'dullness', 'uneven tone', 'aging', 'pigmentation'],
    types: ['all'], stock: 42, cost: 22.0, expiryDate: '2027-03-20', supplier: 'VitaSkin Corp',
    keyIngredients: ['Vitamin C', 'Ferulic Acid'],
    howToUse: 'Apply a pea-sized amount each morning after cleansing. Always follow with SPF during the day.',
  },
  {
    sku: 'PG-CLAY-04', name: 'Clay Mask', desc: 'Deep pore cleansing', price: 34.99, emoji: '🎭',
    certs: ['organic', 'vegan', 'cruelty-free'], concerns: ['acne', 'blackheads', 'oily', 'large pores'],
    types: ['oily', 'combination'], stock: 28, cost: 11.25, expiryDate: '2026-08-30', supplier: 'EarthClay Supplies',
    keyIngredients: ['Kaolin Clay', 'Tea Tree'],
    howToUse: 'Spread an even layer over clean skin, avoiding eyes. Leave 10-15 min, then rinse. Use 1-2x per week.',
  },
  {
    sku: 'PG-NIGHT-05', name: 'Night Cream', desc: 'Bakuchiol & peptides', price: 69.99, emoji: '🌙',
    certs: ['organic', 'vegan', 'cruelty-free'], concerns: ['wrinkles', 'aging', 'firmness', 'fine lines'],
    types: ['mature', 'dry', 'normal'], stock: 18, cost: 27.5, expiryDate: '2027-01-10', supplier: 'NightGlow Inc',
    keyIngredients: ['Bakuchiol', 'Peptides'],
    howToUse: 'Smooth over clean skin every night as the final step of your routine.',
  },
  {
    sku: 'PG-OIL-06', name: 'Face Oil', desc: 'Jojoba, argan & rosehip', price: 44.99, emoji: '🌰',
    certs: ['organic', 'vegan'], concerns: ['dryness', 'sensitivity', 'redness', 'dry'],
    types: ['dry', 'normal', 'sensitive'], stock: 60, cost: 16.0, expiryDate: '2027-06-25', supplier: 'Organic Oils Co',
    keyIngredients: ['Jojoba', 'Argan', 'Rosehip'],
    howToUse: 'Warm 3-4 drops between palms and gently press onto skin as the last step, morning or night.',
  },
];

async function seed() {
  await connect();

  for (const p of PRODUCTS) {
    await Product.updateOne({ sku: p.sku }, { $set: p }, { upsert: true });
  }
  console.log(`✅ Seeded ${PRODUCTS.length} products`);

  // Seed supplier configs WITHOUT clobbering any settings the admin has saved.
  for (const s of SUPPLIERS) {
    await Supplier.updateOne({ key: s.key }, { $setOnInsert: s }, { upsert: true });
  }
  console.log(`✅ Seeded ${SUPPLIERS.length} dropshipping suppliers (disabled until configured)`);

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
