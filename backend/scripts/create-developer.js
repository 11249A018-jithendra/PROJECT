#!/usr/bin/env node
// Creates (or upgrades) the Developer console account. Run it yourself:
//
//   cd backend
//   node scripts/create-developer.js you@example.com "Your Name"
//
// It asks for the password in the terminal (typing is hidden). The developer
// account can only sign in to the Developer console on this computer.
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { askHidden } = require('../utils/askHidden');
const supabase = require('../supabase');
const { passwordProblem, hashPassword } = require('../utils/password');

const [email, name = 'Developer'] = process.argv.slice(2);
if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/create-developer.js you@example.com "Your Name"');
  process.exit(1);
}

(async () => {
  const password = await askHidden('Developer password (min 8, letters + numbers): ');
  const problem = passwordProblem(password);
  if (problem) { console.error(`✖ ${problem}`); process.exit(1); }
  if ((await askHidden('Type it again: ')) !== password) { console.error('✖ Passwords do not match.'); process.exit(1); }

  const cleanEmail = email.trim().toLowerCase();
  const now = new Date().toISOString();
  const fields = { role: 'developer', name, password: await hashPassword(password), password_changed_at: now, is_active: true, updated_at: now };

  const { data: existing } = await supabase.from('users').select('_id, role').ilike('email', cleanEmail).maybeSingle();
  // Never silently turn a student/staff account into a developer.
  if (existing && existing.role !== 'developer') {
    console.error(`✖ ${cleanEmail} already belongs to a ${existing.role} account. Use a different email for the developer account.`);
    process.exit(1);
  }
  const { error } = existing
    ? await supabase.from('users').update(fields).eq('_id', existing._id)
    : await supabase.from('users').insert({ ...fields, email: cleanEmail });
  if (error) { console.error('✖', error.message); process.exit(1); }

  console.log(existing
    ? `✔ Password updated for developer ${cleanEmail}.`
    : `✔ Developer account created for ${cleanEmail}.`);
  console.log('  Start the console with:  cd frontend && npm run dev   →  http://localhost:5173/developer/');
  process.exit(0);
})();
