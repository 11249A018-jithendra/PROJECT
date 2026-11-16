// Strict Current-Day Policy:
// Admin & Warden may only act on the current IST day (attendance, issuing/approving
// outpasses). One message so every endpoint agrees.
const CURRENT_DAY_ONLY = 'Access denied: You can manage student attendance and issue/approve outpasses for the current date only.';
const WARDEN_TODAY_ONLY = CURRENT_DAY_ONLY;

module.exports = { CURRENT_DAY_ONLY, WARDEN_TODAY_ONLY };

