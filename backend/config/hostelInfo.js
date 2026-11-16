// Facts about YOUR hostel that the Hostel Assistant chatbot is allowed to tell
// students. The assistant never invents rules, timings or facilities: if a
// list below is empty it tells the student to check Announcements or ask the
// warden. Fill these in (plain sentences) and restart the backend.
module.exports = {
  // Shown on the student dashboard too (StudentDashboard.jsx → MESS_TIMINGS).
  messTimings: [
    'Breakfast: 7:30 AM – 9:00 AM',
    'Lunch: 12:30 PM – 2:00 PM',
    'Evening snacks: 4:30 PM – 5:00 PM',
    'Dinner: 7:30 PM – 9:00 PM',
  ],

  // e.g. 'Main gate closes at 9:30 PM.', 'Study hours: 8:00 PM – 10:00 PM.'
  hostelTimings: [],

  // e.g. 'Visitors are allowed only in the visitor lounge.', 'No ragging.'
  rules: [],

  // e.g. 'Wi-Fi on every floor', 'Laundry room on the ground floor', 'Gym'
  facilities: [],
};
