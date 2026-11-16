const supabase = require('../supabase');
const { hasHostelTracking } = require('../utils/schema');
const { withoutPassword } = require('../utils/password');

// @desc    Update student profile
// @route   PUT /api/students/profile
// @access  Private (student)
const updateProfile = async (req, res) => {
  try {
    // room_no is not editable here: rooms are assigned by the admin.
    const { name, phone, parent_contact, course_year, home_address } = req.body;
    // Build a forward-slash relative path ourselves: req.file.path uses the
    // OS separator, which breaks the URL when the server runs on Windows.
    const profile_photo = req.file ? `uploads/${req.file.filename}` : undefined;

    const updates = {};
    // Lengths and formats are checked in routes/studentRoutes.js.
    const text = (v) => String(v).trim();
    if (name) updates.name = text(name);
    if (phone) updates.phone = text(phone);
    if (parent_contact) updates.parent_contact = text(parent_contact);
    if (course_year) updates.course_year = text(course_year);
    if (profile_photo) updates.profile_photo = profile_photo;
    if (home_address !== undefined && (await hasHostelTracking())) updates.home_address = text(home_address ?? '') || null;
    updates.updated_at = new Date();

    const { data: updated, error } = await supabase
      .from('users')
      .update(updates)
      .eq('_id', req.user._id)
      .select('*')
      .single();

    if (error) throw error;
    res.json(withoutPassword(updated));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get warden and security staff contacts
// @route   GET /api/students/contacts
// @access  Private
const getStaffContacts = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('name, role, email, phone')
      .in('role', ['warden', 'security'])
      .eq('is_active', true);

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { updateProfile, getStaffContacts };
