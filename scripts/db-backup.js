'use strict';

// Back up the MongoDB database with mongodump, using the app's config.
// Usage: npm run db:backup
const { spawnSync } = require('child_process');
const path = require('path');
const config = require('../src/config');

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const out = path.join('backups', ts);

console.log(`Backing up ${config.mongo.uri}/${config.mongo.db} → ${out}`);
const res = spawnSync(
  'mongodump',
  ['--uri', config.mongo.uri, '--db', config.mongo.db, '--out', out],
  { stdio: 'inherit' }
);

if (res.error) {
  console.error('\n❌ mongodump not found. Install MongoDB Database Tools:');
  console.error('   https://www.mongodb.com/docs/database-tools/installation/');
  process.exit(1);
}
if (res.status === 0) console.log(`\n✅ Backup complete: ${out}/${config.mongo.db}`);
process.exit(res.status || 0);
