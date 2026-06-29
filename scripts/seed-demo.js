'use strict';

// Populate the catalogue with a realistic (fictional) EU organic-skincare demo
// set so the storefront looks like a real shop.
//
//   npm run seed:demo            # add/refresh the demo products
//   npm run seed:demo -- --clear # remove all demo products
const { connect, disconnect } = require('../src/db/connection');
const Product = require('../src/models/Product');
const DEMO = require('../src/db/demoProducts');

function slug(name, i) {
  const s = String(name).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 16);
  return `DEMO-${s}-${String(i + 1).padStart(2, '0')}`;
}

(async () => {
  await connect();

  if (process.argv.includes('--clear')) {
    const { deletedCount } = await Product.deleteMany({ source: 'demo' });
    console.log(`🧹 Removed ${deletedCount} demo products.`);
    await disconnect();
    return;
  }

  let added = 0;
  for (let i = 0; i < DEMO.length; i++) {
    const d = DEMO[i];
    const sku = slug(d.name, i);
    const doc = {
      sku,
      name: d.name,
      brand: d.brand,
      desc: d.desc,
      emoji: d.emoji || '🧴',
      price: d.price,
      supplierPrice: d.supplierPrice || 0,
      cost: d.supplierPrice || 0,
      concerns: d.concerns || [],
      types: d.types || ['all'],
      certs: d.certs || [],
      keyIngredients: d.keyIngredients || [],
      howToUse: d.howToUse || '',
      stock: 20 + ((i * 7) % 80), // varied, deterministic
      active: true,
      source: 'demo',
      images: [],
    };
    await Product.updateOne({ sku }, { $set: doc }, { upsert: true });
    added += 1;
  }

  const total = await Product.countDocuments();
  console.log(`✅ Seeded ${added} demo products (source: "demo"). Catalogue now has ${total} products.`);
  console.log('   Remove them anytime with:  npm run seed:demo -- --clear');
  await disconnect();
})().catch((err) => {
  console.error('Demo seed failed:', err.message);
  process.exit(1);
});
