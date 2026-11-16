const supabase = require('../supabase');

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_MENU = [
  { day: 'Monday',    breakfast: 'Idli, Sambar',    lunch: 'Rice, Sambar, Poriyal',   snacks: 'Tea & Biscuits',      dinner: 'Chapati, Kurma' },
  { day: 'Tuesday',   breakfast: 'Pongal, Chutney', lunch: 'Rice, Rasam, Vegetables', snacks: 'Banana / Fruit',      dinner: 'Dosa, Sambar' },
  { day: 'Wednesday', breakfast: 'Dosa, Sambar',    lunch: 'Rice, Curd, Poriyal',     snacks: 'Tea & Snacks',        dinner: 'Chapati, Channa Masala' },
  { day: 'Thursday',  breakfast: 'Upma, Chutney',   lunch: 'Rice, Sambar, Poriyal',   snacks: 'Murmura / Bhel',     dinner: 'Idiyappam, Kurma' },
  { day: 'Friday',    breakfast: 'Poori, Masala',   lunch: 'Rice, Rasam, Vegetables', snacks: 'Tea & Biscuits',      dinner: 'Parotta, Kurma' },
  { day: 'Saturday',  breakfast: 'Idli, Chutney',   lunch: 'Variety Rice, Poriyal',   snacks: 'Fruit Juice / Juice', dinner: 'Dosa, Chutney' },
  { day: 'Sunday',    breakfast: 'Pongal, Vada',    lunch: 'Biryani, Raita',          snacks: 'Tea & Snacks',        dinner: 'Chapati, Vegetable Curry' },
];

// GET /api/mess/menu  — public (all logged-in users)
const getMenu = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('mess_menu')
      .select('day, breakfast, lunch, snacks, dinner')
      .order('id', { ascending: true });
    if (error) throw error;
    const menu = data && data.length === 7 ? data : DEFAULT_MENU;
    res.json(menu);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/mess/menu  — admin only
const updateMenu = async (req, res) => {
  try {
    const { menu } = req.body;
    if (!Array.isArray(menu) || menu.length !== 7)
      return res.status(400).json({ message: 'Provide all 7 days in the menu array.' });

    for (const row of menu) {
      if (!DAYS.includes(row?.day))
        return res.status(400).json({ message: `Invalid day: ${row?.day}` });
      for (const field of ['breakfast', 'lunch', 'snacks', 'dinner']) {
        if (typeof row[field] !== 'string' || row[field].trim().length < 2)
          return res.status(400).json({ message: `${field} for ${row.day} must be at least 2 characters.` });
      }
    }
    if (new Set(menu.map((r) => r.day)).size !== DAYS.length)
      return res.status(400).json({ message: 'Each day must appear exactly once.' });

    // id is tied to the day (1 = Monday … 7 = Sunday), not to array order.
    const rows = menu.map((r) => ({
      id: DAYS.indexOf(r.day) + 1,
      day: r.day,
      breakfast: r.breakfast.trim(),
      lunch: r.lunch.trim(),
      snacks: r.snacks.trim(),
      dinner: r.dinner.trim(),
    }));

    const { error } = await supabase.from('mess_menu').upsert(rows, { onConflict: 'id' });
    if (error) throw error;

    res.json({ message: 'Mess menu updated successfully.', menu: rows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getMenu, updateMenu };
