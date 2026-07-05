'use strict';

// Restore a MongoDB backup created by db-backup.js.
// Usage: npm run db:restore -- backups/<timestamp>
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: npm run db:restore -- backups/<timestamp>');
  const root = 'backups';
  if (fs.existsSync(root)) {
    console.error('\nAvailable backups:');
    fs.readdirSync(root).forEach((d) => console.error('  backups/' + d));
  }
  process.exit(1);
}

const dumpPath = path.join(dir, config.mongo.db);
if (!fs.existsSync(dumpPath)) {
  console.error(`❌ No dump for db "${config.mongo.db}" at ${dumpPath}`);
  process.exit(1);
}

console.log(`Restoring ${dumpPath} → ${config.mongo.uri}/${config.mongo.db} (with --drop)`);
const res = spawnSync(
  'mongorestore',
  ['--uri', config.mongo.uri, '--db', config.mongo.db, '--drop', dumpPath],
  { stdio: 'inherit' }
);

if (res.error) {
  console.error('\n❌ mongorestore not found. Install MongoDB Database Tools.');
  process.exit(1);
}
if (res.status === 0) console.log('\n✅ Restore complete.');
process.exit(res.status || 0);
