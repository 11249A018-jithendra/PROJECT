const supabase = require('../supabase');

// Inserts one notification row per recipient. Best-effort: a notification
// failure (e.g. the notifications table hasn't been migrated yet) is logged
// and never breaks the request that triggered it.
const notifyUsers = async (userIds, { type = 'info', title, message = null, link = null, complaint_id = null }) => {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  if (ids.length === 0) return;
  try {
    const rows = ids.map((user_id) => ({ user_id, type, title, message, link, complaint_id }));
    const { error } = await supabase.from('notifications').insert(rows);
    if (error) throw error;
  } catch (err) {
    console.warn(`[notify] could not create "${type}" notification: ${err.message}`);
  }
};

// Fans a notification out to every user with the given role (e.g. all admins).
const notifyRole = async (role, payload) => {
  try {
    // Deactivated accounts are skipped.
    const { data, error } = await supabase.from('users').select('_id').eq('role', role).eq('is_active', true);
    if (error) throw error;
    await notifyUsers((data || []).map((u) => u._id), payload);
  } catch (err) {
    console.warn(`[notify] could not load ${role} users: ${err.message}`);
  }
};

module.exports = { notifyUsers, notifyRole };
