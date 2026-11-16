const data = require('./chatStudentData');
const { NOT_FOUND, TEXT, hostelInfo } = require('./chatKnowledge');

// The assistant's built-in answers: used when no AI provider is configured,
// and whenever the AI call fails. It recognises the question from keywords
// and answers from the knowledge base or the student's real records — it
// never makes anything up.

const bullets = (items) => items.map((i) => `• ${i}`).join('\n');
const published = (items, what) =>
  items.length ? `${what}:\n${bullets(items)}` : `The ${what.toLowerCase()} are not published here yet. Please check Announcements or contact your hostel warden.`;

const personal = (m) => /\b(my|mine|i|me|do i|am i|have i)\b/.test(m);

const roomAnswer = async (id) => {
  const r = await data.getRoom(id);
  if (!r.found || !r.room_no) return 'You have not been assigned a room yet. Please contact your hostel warden.';
  const parts = [`Your room number is ${r.room_no}${r.hostel ? ` in ${r.hostel}` : ''}.`];
  if (r.floor) parts.push(`Floor: ${r.floor}.`);
  if (r.beds_in_room) parts.push(`It is a ${r.beds_in_room}-bed room.`);
  if (r.warden_name) parts.push(`Your warden is ${r.warden_name}.`);
  return parts.join(' ');
};

const attendanceAnswer = async (id) => {
  const a = await data.getAttendance(id);
  if (!a.has_records) return `No attendance has been marked for you yet. Today: ${a.today}.`;
  const m = a.this_month;
  const lines = [`Your overall attendance is ${a.overall.percentage}% (${a.overall.present} present, ${a.overall.absent} absent).`];
  if (m.percentage !== null) lines.push(`This month: ${m.percentage}% (${m.present} present, ${m.absent} absent).`);
  lines.push(`Today: ${a.today}.`);
  return lines.join(' ');
};

const outpassAnswer = async (id) => {
  const o = await data.getOutpasses(id);
  if (!o.latest) return 'You have not requested any outpasses yet. To apply, open "Outpass" and tap "Apply New Outpass".';
  const l = o.latest;
  const parts = [`Your latest outpass is ${l.status.toUpperCase()}${l.overdue ? ' and OVERDUE' : ''}: ${l.type} to ${l.destination}, leaving ${l.leave_at}, return by ${l.return_by}.`];
  if (l.status === 'Rejected' && l.rejection_reason) parts.push(`Reason: ${l.rejection_reason}`);
  if (l.status === 'Approved') parts.push('Open "Outpass" → "View QR" to show it at the gate.');
  if (l.status === 'Checked Out') parts.push(`You left at ${l.left_at}. Scan in at the gate when you return.`);
  if (l.status === 'Returned') parts.push(`You returned at ${l.returned_at}.`);
  if (l.overdue) parts.push('Please return and contact your warden.');
  return parts.join(' ');
};

const complaintsAnswer = async (id) => {
  const c = await data.getComplaints(id);
  if (!c.total) return 'You have not filed any complaints. To file one, open "Complaints".';
  const open = c.pending + c.in_progress;
  const head = `You currently have ${c.pending} pending complaint${c.pending === 1 ? '' : 's'}${c.in_progress ? ` and ${c.in_progress} in progress` : ''} (${c.total} in total).`;
  if (!open) return `${head} Nothing is waiting right now.`;
  const waiting = c.recent.filter((x) => ['Pending', 'In Progress'].includes(x.status)).slice(0, 3);
  return `${head}\n${bullets(waiting.map((x) => `${x.title} — ${x.status}${x.escalated_to_admin ? ' (escalated to admin)' : ''}`))}`;
};

const wardenAnswer = async (id) => {
  const w = await data.getWardenContact(id);
  if (!w.assigned) return `No warden is assigned to you yet. ${TEXT.WARDEN_INFO}`;
  return `Your warden is ${w.name}${w.phone ? ` — phone ${w.phone}` : ''}. You can also call from the Emergency Help card on your Dashboard or the "Help" page.`;
};

const announcementsAnswer = async (id) => {
  const a = await data.getAnnouncements(id);
  if (!a.count) return `There are no current announcements. ${TEXT.ANNOUNCEMENTS_INFO}`;
  return `Latest announcements:\n${bullets(a.announcements.slice(0, 3).map((x) => `${x.priority !== 'Normal' ? `[${x.priority}] ` : ''}${x.title} (${x.posted_on})`))}\nOpen "Announcements" to read them in full.`;
};

const menuAnswer = async () => {
  const m = await data.getMessMenu();
  const timings = hostelInfo.messTimings.length ? `\nMess timings:\n${bullets(hostelInfo.messTimings)}` : '';
  if (!m.found) return `Today's menu is not available.${timings}`;
  return `Today's menu (${m.day}):\n${bullets([`Breakfast: ${m.breakfast}`, `Lunch: ${m.lunch}`, `Snacks: ${m.snacks}`, `Dinner: ${m.dinner}`])}${timings}`;
};

// First match wins — the more specific questions come first.
const INTENTS = [
  [/\b(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/, () => 'Hello! Ask me about outpasses, attendance, complaints, your room, announcements or how to contact your warden.', (m) => m.length < 25],
  [/\b(thanks|thank you|thankyou)\b/, () => "You're welcome! Anything else I can help with?"],
  [/overdue|late return|returned? late|come back late/, () => TEXT.OUTPASS_OVERDUE],
  [/token|manual (code|verif|entry)|8.?(digit|char)/, () => TEXT.OUTPASS_TOKEN],
  [/\bqr\b|scan|security check/, (m) => (/how.*(scan|work)|security/.test(m) ? TEXT.OUTPASS_SCAN : TEXT.OUTPASS_QR)],
  [/return status|returned|check.?in/, (m, id) => (personal(m) ? outpassAnswer(id) : TEXT.OUTPASS_RETURN)],
  [/(apply|request|get|take|new|raise).*(outpass|out pass|gate ?pass|leave)|how.*(outpass|out pass|gate ?pass).*(apply|work)/, () => TEXT.OUTPASS_APPLY],
  [/(approve|reject|cancel).*(outpass|out pass|gate ?pass)/, () => 'I can\'t approve, reject or cancel outpasses — only your warden or the admin can. You can see the decision under "Outpass".'],
  [/outpass|out pass|gate ?pass/, (m, id) => (/\bhow\b/.test(m) && !/\b(latest|last|recent|status of my|my)\b/.test(m) ? TEXT.OUTPASS_STATUS : outpassAnswer(id))],
  [/categor/, () => TEXT.COMPLAINT_CATEGORIES],
  [/(resolve|close|fix).*(complaint)/, () => `I can't resolve complaints — your warden or the admin does that. ${TEXT.COMPLAINT_STATUS}`],
  [/(submit|file|raise|register|make|new|report).*(complaint|issue|problem)|how.*complaint/, () => `${TEXT.COMPLAINT_SUBMIT} ${TEXT.COMPLAINT_CATEGORIES}`],
  [/complaint|grievance/, (m, id) => complaintsAnswer(id)],
  [/attendance|present|absent|roll call/, (m, id) => (/\bhow\b/.test(m) && !/\b(much|many)\b/.test(m) && !/percent|%/.test(m) ? `${TEXT.ATTENDANCE_INFO}` : attendanceAnswer(id))],
  [/\broom\b|room ?(no|number|details)|which hostel|my hostel|\bblock\b|\bbed\b/, (m, id) => roomAnswer(id)],
  [/warden|contact|phone number|call|emergency|sos/, (m, id) => wardenAnswer(id)],
  [/announcement|notice|circular|news/, (m, id) => (/\bhow\b/.test(m) ? TEXT.ANNOUNCEMENTS_INFO : announcementsAnswer(id))],
  [/menu|food|breakfast|lunch|dinner|snack|mess/, () => menuAnswer()],
  [/timing|what time|curfew|gate clos|open(ing)? hours|in.?time/, () => (hostelInfo.hostelTimings.length
    ? published(hostelInfo.hostelTimings, 'Hostel timings')
    : `${published(hostelInfo.hostelTimings, 'Hostel timings')}${hostelInfo.messTimings.length ? `\nMess timings:\n${bullets(hostelInfo.messTimings)}` : ''}`)],
  [/\brules?\b|regulation|allowed|permitted|guideline/, () => published(hostelInfo.rules, 'Hostel rules')],
  [/facilit|wi-?fi|laundry|gym|library|amenit/, () => published(hostelInfo.facilities, 'Hostel facilities')],
  [/what can you do|help|who are you/, () => 'I can tell you your room, attendance, latest outpass and complaints, and explain how outpasses, QR codes, tokens, complaints and announcements work.'],
];

// Returns the reply text for a message from the signed-in student.
const answer = async (message, studentId) => {
  const m = String(message || '').toLowerCase();
  for (const [pattern, reply, guard] of INTENTS) {
    if (pattern.test(m) && (!guard || guard(m))) return reply(m, studentId);
  }
  return NOT_FOUND;
};

module.exports = { answer };
