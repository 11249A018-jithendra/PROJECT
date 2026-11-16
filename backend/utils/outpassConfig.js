// Minutes past expected_return_datetime before a checked-out student is
// considered overdue. Configurable via env so wardens can tune it without a
// code change.
const OVERDUE_GRACE_MINUTES = Number(process.env.OUTPASS_GRACE_MINUTES) || 30;

// How early before the approved leave time a student may exit at the gate
// (so a pass for Saturday can't be used on Wednesday).
const EARLY_EXIT_MINUTES = Number(process.env.OUTPASS_EARLY_EXIT_MINUTES) || 60;

module.exports = { OVERDUE_GRACE_MINUTES, EARLY_EXIT_MINUTES };
