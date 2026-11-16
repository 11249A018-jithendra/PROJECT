const { runEscalationCheck, runAdminReminders, ESCALATION_HOURS } = require('./complaintEscalation');
const { runOverdueAlerts, runExpirePending } = require('./outpassAlerts');
const { runGoneHomeAbsent, closePastAttendance } = require('./attendanceAuto');

// One background loop for every time-based rule. Each job is independent:
// a failure in one is logged and never stops the others.
const INTERVAL_MINUTES = Number(process.env.BACKGROUND_JOB_MINUTES || process.env.COMPLAINT_ESCALATION_CHECK_MINUTES) || 10;

const JOBS = [
  ['complaint escalation', runEscalationCheck],
  ['admin reminders', runAdminReminders],
  ['overdue outpass alerts', runOverdueAlerts],
  ['expire unreviewed outpass requests', runExpirePending],
  ['gone-home attendance', runGoneHomeAbsent],
  ['daily attendance lock', closePastAttendance],
];

let timer = null;
let running = false;

const tick = async () => {
  if (running) return; // previous tick still in progress
  running = true;
  try {
    for (const [name, job] of JOBS) {
      try {
        await job();
      } catch (e) {
        console.error(`[scheduler] ${name} failed:`, e.message);
      }
    }
  } finally {
    running = false;
  }
};

const startScheduler = () => {
  if (timer) return;
  tick();
  timer = setInterval(tick, INTERVAL_MINUTES * 60 * 1000);
  console.log(`[scheduler] background jobs every ${INTERVAL_MINUTES} min (complaint escalation after ${ESCALATION_HOURS}h)`);
};

module.exports = { startScheduler, tick };
