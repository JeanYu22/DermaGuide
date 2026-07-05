'use strict';

// Print where the app stores its data and how many docs are in each
// collection. Usage: npm run db:info
const { connect, disconnect, mongoose } = require('../src/db/connection');
const config = require('../src/config');

(async () => {
  console.log(`MongoDB URI : ${config.mongo.uri}`);
  console.log(`Database    : ${config.mongo.db}\n`);

  await connect();
  const collections = await mongoose.connection.db.listCollections().toArray();
  if (!collections.length) {
    console.log('(no collections yet — run "npm run seed")');
  }
  for (const c of collections.sort((a, b) => a.name.localeCompare(b.name))) {
    const n = await mongoose.connection.db.collection(c.name).countDocuments();
    console.log(`  ${c.name.padEnd(16)} ${n}`);
  }

  // Show a few product names so you can confirm they're there.
  const products = await mongoose.connection.db
    .collection('products')
    .find({}, { projection: { name: 1, sku: 1, source: 1 } })
    .limit(10)
    .toArray()
    .catch(() => []);
  if (products.length) {
    console.log('\nSample products (collection "products"):');
    products.forEach((p) => console.log(`  • ${p.name}  [${p.sku}]  (${p.source || 'manual'})`));
  }

  await disconnect();
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
