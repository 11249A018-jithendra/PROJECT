/**
 * Seed Script - Creates the initial admin, warden and security accounts.
 * Run with: node seed.js
 *
 * There are no built-in passwords: for each account that doesn't exist yet it
 * asks you for one (typing shows * only). Existing accounts are left alone —
 * reset those from the Developer console or the admin pages.
 */
const dotenv = require('dotenv');
dotenv.config({ quiet: true });

const supabase = require('./supabase');
const { passwordProblem, hashPassword } = require('./utils/password');
const { askHidden } = require('./utils/askHidden');

const ACCOUNTS = [
  { role: 'admin', name: 'Super Admin', email: 'admin@hostel.com' },
  { role: 'warden', name: 'Warden', email: 'warden@hostel.com' },
  { role: 'security', name: 'Security Guard', email: 'security@hostel.com' },
];

const askPassword = async (email) => {
  for (;;) {
    const password = await askHidden(`Password for ${email} (min 8, letters + numbers, Enter to skip): `);
    if (!password) return null;
    const problem = passwordProblem(password);
    if (problem) { console.log(`  ✖ ${problem}`); continue; }
    if ((await askHidden('Type it again: ')) === password) return password;
    console.log('  ✖ Passwords do not match.');
  }
};

const seedAccount = async ({ role, name, email }) => {
  const { data: existing } = await supabase.from('users').select('_id').ilike('email', email).limit(1).maybeSingle();
  if (existing) {
    console.log(`Already exists: ${email} (${role})`);
    return;
  }

  const password = await askPassword(email);
  if (!password) {
    console.log(`Skipped ${email}`);
    return;
  }
  const { error } = await supabase.from('users').insert({ role, name, email, password: await hashPassword(password) });
  if (error) throw error;

  console.log(`✅ Created ${role}: ${email}`);
};

const seedAll = async () => {
  try {
    for (const account of ACCOUNTS) {
      await seedAccount(account);
    }
    process.exit(0);
  } catch (error) {
    console.error('Error seeding accounts:', error.message);
    process.exit(1);
  }
};

seedAll();
