'use strict';

// Promote a user to admin (and optionally set their password). Creates the
// account if it doesn't exist and a password is given.
//
// Usage:
//   node scripts/make-admin.js you@example.com               # promote existing
//   node scripts/make-admin.js you@example.com NewPass123!   # promote + set/reset password (creates if missing)
const { connect, disconnect } = require('../src/db/connection');
const User = require('../src/models/User');

(async () => {
  const email = (process.argv[2] || '').toLowerCase();
  const password = process.argv[3];
  if (!email) {
    console.error('Usage: node scripts/make-admin.js <email> [password]');
    process.exit(1);
  }

  await connect();
  let user = await User.findOne({ email });

  if (!user) {
    if (!password) {
      console.error(`No user "${email}" exists. Re-run with a password to create an admin:`);
      console.error(`  node scripts/make-admin.js ${email} SomePassword123!`);
      await disconnect();
      process.exit(1);
    }
    user = new User({ email, name: 'Admin' });
    await user.setPassword(password);
    user.role = 'admin';
    await user.save();
    console.log(`✅ Created admin account: ${email}`);
  } else {
    user.role = 'admin';
    if (password) await user.setPassword(password);
    await user.save();
    console.log(`✅ ${email} is now an admin${password ? ' (password reset)' : ''}.`);
  }

  await disconnect();
})().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});
