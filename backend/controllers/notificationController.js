const supabase = require('../supabase');

// Missing table (migration not run yet) → behave as "no notifications"
// rather than surfacing an error in every page's header.
const isMissingTable = (error) => error && /notifications/.test(error.message || '') && /(schema cache|does not exist)/.test(error.message || '');

// @desc    Current user's latest notifications + unread count
// @route   GET /api/notifications
// @access  Private
const getMyNotifications = async (req, res) => {
  try {
    const [{ data, error }, { count, error: countErr }] = await Promise.all([
      supabase
        .from('notifications')
        .select('*')
        .eq('user_id', req.user._id)
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user._id)
        .eq('is_read', false),
    ]);
    if (isMissingTable(error) || isMissingTable(countErr)) return res.json({ notifications: [], unread: 0 });
    if (error) throw error;
    res.json({ notifications: data || [], unread: count || 0 });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark one notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private (owner only)
const markRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('_id', req.params.id)
      .eq('user_id', req.user._id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Mark all of the current user's notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
const markAllRead = async (req, res) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user._id)
      .eq('is_read', false);
    if (error && !isMissingTable(error)) throw error;
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMyNotifications, markRead, markAllRead };
