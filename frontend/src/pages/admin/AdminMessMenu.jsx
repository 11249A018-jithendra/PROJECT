import { useState, useEffect } from "react";
import Layout from "../../components/Layout";
import api from "../../api/axios";
import { confirmAction } from "../../components/ui/ConfirmDialog";
import {
  UtensilsCrossed,
  Save,
  RotateCcw,
  CheckCircle,
  AlertCircle,
  Sun,
  Sandwich,
  Coffee,
  Moon,
} from "lucide-react";

const MESS_TIMINGS = [
  { label: "Breakfast",      time: "7:30 AM – 9:00 AM",   icon: Sun,      color: "#f59e0b", bg: "#fffbeb" },
  { label: "Lunch",          time: "12:30 PM – 2:00 PM",  icon: Sandwich, color: "#10b981", bg: "#ecfdf5" },
  { label: "Evening Snacks", time: "4:30 PM – 5:00 PM",   icon: Coffee,   color: "#8b5cf6", bg: "#f5f3ff" },
  { label: "Dinner",         time: "7:30 PM – 9:00 PM",   icon: Moon,     color: "#3b82f6", bg: "#eff6ff" },
];

const FIELDS = [
  { key: "breakfast", label: "Breakfast",      emoji: "🌅", color: "text-amber-700",   bg: "#fffbeb" },
  { key: "lunch",     label: "Lunch",          emoji: "🍱", color: "text-emerald-700", bg: "#ecfdf5" },
  { key: "snacks",    label: "Evening Snacks", emoji: "☕", color: "text-violet-700",  bg: "#f5f3ff" },
  { key: "dinner",    label: "Dinner",         emoji: "🌙", color: "text-blue-700",    bg: "#eff6ff" },
];

const DEFAULT_MENU = [
  { day: "Monday",    breakfast: "Idli, Sambar",    lunch: "Rice, Sambar, Poriyal",   snacks: "Tea & Biscuits",      dinner: "Chapati, Kurma" },
  { day: "Tuesday",   breakfast: "Pongal, Chutney", lunch: "Rice, Rasam, Vegetables", snacks: "Banana / Fruit",      dinner: "Dosa, Sambar" },
  { day: "Wednesday", breakfast: "Dosa, Sambar",    lunch: "Rice, Curd, Poriyal",     snacks: "Tea & Snacks",        dinner: "Chapati, Channa Masala" },
  { day: "Thursday",  breakfast: "Upma, Chutney",   lunch: "Rice, Sambar, Poriyal",   snacks: "Murmura / Bhel",     dinner: "Idiyappam, Kurma" },
  { day: "Friday",    breakfast: "Poori, Masala",   lunch: "Rice, Rasam, Vegetables", snacks: "Tea & Biscuits",      dinner: "Parotta, Kurma" },
  { day: "Saturday",  breakfast: "Idli, Chutney",   lunch: "Variety Rice, Poriyal",   snacks: "Fruit Juice / Juice", dinner: "Dosa, Chutney" },
  { day: "Sunday",    breakfast: "Pongal, Vada",    lunch: "Biryani, Raita",          snacks: "Tea & Snacks",        dinner: "Chapati, Vegetable Curry" },
];

const AdminMessMenu = () => {
  const [menu, setMenu] = useState(DEFAULT_MENU);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null); // { type: 'success'|'error', msg }

  const todayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];

  useEffect(() => {
    api.get("/mess/menu")
      .then(({ data }) => {
        if (data && data.length === 7) setMenu(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleChange = (dayIdx, field, value) => {
    setMenu(prev => prev.map((row, i) => i === dayIdx ? { ...row, [field]: value } : row));
  };

  const handleReset = async () => {
    if (await confirmAction({
      title: "Reset to the default menu?",
      message: "Unsaved changes will be lost.",
      confirmLabel: "Reset",
      danger: true
    })) {
      setMenu(DEFAULT_MENU);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setToast(null);
    try {
      await api.put("/mess/menu", { menu });
      setToast({ type: "success", msg: "Mess menu saved successfully! All students will see these updates." });
    } catch (err) {
      setToast({ type: "error", msg: err.response?.data?.message || "Failed to save menu." });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mess Menu Management</h1>
          <p className="text-slate-500 mt-1 text-sm">Edit the weekly food menu shown to all students</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            <RotateCcw size={16} /> Reset to Default
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 shadow-sm shadow-indigo-200"
          >
            <Save size={16} /> {saving ? "Saving…" : "Save Menu"}
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center gap-3 px-5 py-3.5 rounded-xl mb-6 text-sm font-medium ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {toast.type === "success" ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* ── Mess Timetable Card (matches Student Dashboard layout) ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {/* Card Banner Header */}
        <div
          style={{ background: "linear-gradient(135deg, #1e3a5f 0%, #2d5986 100%)" }}
          className="p-5 flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <UtensilsCrossed size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-base">Hostel Mess Timetable</h3>
              <p className="text-blue-200 text-xs mt-0.5">Good Food • Healthy Life • Happy Stay</p>
            </div>
          </div>
          <span className="hidden sm:inline-block text-xs font-medium px-3 py-1 rounded-full bg-white/10 text-blue-100 border border-white/20">
            Weekly Editor
          </span>
        </div>

        {/* Mess Timings Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b border-slate-100">
          {MESS_TIMINGS.map(({ label, time, icon: Icon, color, bg }) => (
            <div
              key={label}
              style={{ background: bg, border: `1px solid ${color}22` }}
              className="rounded-xl p-3 flex flex-col items-center text-center gap-1.5"
            >
              <div style={{ background: `${color}18` }} className="w-9 h-9 rounded-full flex items-center justify-center">
                <Icon size={18} style={{ color }} />
              </div>
              <p style={{ color }} className="text-xs font-semibold">{label}</p>
              <p className="text-slate-600 text-xs font-medium">{time}</p>
            </div>
          ))}
        </div>

        {/* Weekly Menu Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold text-xs uppercase tracking-wide w-28">
                  Day
                </th>
                {FIELDS.map(f => (
                  <th
                    key={f.key}
                    style={{ background: f.bg }}
                    className={`px-4 py-3 ${f.color} font-semibold text-xs uppercase tracking-wide text-center`}
                  >
                    {f.emoji} {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Loading menu…
                  </td>
                </tr>
              ) : menu.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">
                    Menu not available.
                  </td>
                </tr>
              ) : (
                menu.map((row, dayIdx) => {
                  const isToday = row.day === todayName;
                  return (
                    <tr
                      key={row.day}
                      style={
                        isToday
                          ? { background: "linear-gradient(90deg, #eef2ff 0%, #f0fdf4 100%)", borderLeft: "3px solid #4f46e5" }
                          : { borderLeft: "3px solid transparent" }
                      }
                      className="border-b border-slate-50 transition-colors hover:bg-slate-50/70"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold text-sm ${isToday ? "text-indigo-700" : "text-slate-700"}`}>
                            {row.day}
                          </span>
                          {isToday && (
                            <span className="text-[10px] font-bold bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">
                              Today
                            </span>
                          )}
                        </div>
                      </td>
                      {FIELDS.map(f => (
                        <td key={f.key} className="px-3 py-2.5 text-center">
                          <input
                            type="text"
                            value={row[f.key] ?? ""}
                            onChange={e => handleChange(dayIdx, f.key, e.target.value)}
                            title={row[f.key] || ""}
                            className="w-full text-center px-2 py-1.5 rounded-lg border border-slate-200/90 bg-white text-slate-700 text-xs leading-relaxed focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 hover:border-slate-300 transition-all placeholder:text-slate-300 shadow-2xs"
                            placeholder={`${f.label} for ${row.day}`}
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer with quote and bottom Save button */}
        <div className="px-5 py-3.5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
          <p className="text-slate-400 text-xs italic text-center sm:text-left">
            — Eat Well • Study Well • Grow Well —
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-60 shadow-sm"
          >
            <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </Layout>
  );
};

export default AdminMessMenu;
