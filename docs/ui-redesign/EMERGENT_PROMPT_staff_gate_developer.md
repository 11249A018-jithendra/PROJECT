# Prompt for Emergent — Staff (admin + warden), Gate (security) and Developer console (professional UI)

Copy everything below the line into Emergent.

---

You are redesigning ONLY the **frontend UI** of an existing, working Hostel Management System for three portals: **Staff** (admin + warden), **Gate** (security) and the **Developer console**. The backend is finished and in production. **Do NOT build or change any backend.** Do not create FastAPI, MongoDB, Supabase, a new auth system or new API endpoints. Do not change API URLs, request bodies or response shapes. Frontend only.

## Tech (keep exactly)
- React 19 + Vite + Tailwind CSS 3 + react-router-dom 7 + lucide-react + axios. You may add shadcn/ui, Recharts (charts) and TanStack Table.
- Multi-page app, each portal is its own router:
  - Staff: `/staff` → `src/portals/staff/main.jsx`, pages in `src/pages/admin/` and `src/pages/warden/`, plus shared views `src/pages/security/{Visitors,CurrentlyOutside,ScanHistory,ManualGate}.jsx` and `src/pages/shared/EmergencyCenter.jsx`.
  - Gate: `/gate` → `src/portals/gate/main.jsx`, pages in `src/pages/security/`.
  - Developer: `/developer` → `src/portals/developer/{main.jsx,DevConsole.jsx}`. It is served only by the local dev server and **must stay out of the production build** (do not add it to `build.rollupOptions.input` in `vite.config.js`).
- Shared layout: `src/components/Layout.jsx`, `Sidebar.jsx`, `NotificationBell.jsx`, `Modal.jsx`.
- **Do NOT edit**: `src/api/axios.js`, `src/context/AuthContext.jsx`, `src/portal.js`, `src/components/PrivateRoute.jsx`, `src/portals/PortalShell.jsx`, `vite.config.js`, anything in `src/pages/student/`, `src/portals/student/`, or the `backend/` folder. Keep every route path in `src/portals/*/main.jsx` the same.
- Login (`src/pages/Login.jsx`, shared): staff portal shows an **Admin / Warden** choice and calls `login(email, password, rememberMe, role)`; keep that, keep "Forgot password?" (`POST /auth/forgot-password`), and show server error messages as they are (401 invalid, 403 wrong portal/role, 429 too many attempts).

## Design direction — professional
Calm, dense, trustworthy admin software (think Linear / Stripe dashboard), not flashy.
- Neutral slate palette with ONE indigo accent; status colours only for meaning (green ok, amber warning, red danger).
- Collapsible sidebar with grouped sections, top bar with global search, notification bell, user menu (change password `PUT /auth/password`, logout).
- Data tables with sorting, filters, pagination (`?page=&limit=` — responses are `{ items, total, page, limit, pages }` where paged), row actions, bulk actions, CSV export of what's on screen.
- KPI cards with small trend charts on dashboards; skeleton loaders; toasts; confirm dialogs for destructive actions.
- Light + dark mode. Fully responsive (wardens and guards use phones). Accessible: 4.5:1 contrast, focus rings, labelled inputs, keyboard navigation in tables and dialogs.
- Footer text must remain: "Designed by Jithendra".

## Staff portal — admin pages (`/staff/admin/...`)
- Dashboard `GET /admin/dashboard` (+ escalated complaints link `/admin/complaints?view=escalated`).
- Students `GET /admin/students`, `GET /admin/students/:id`, assign warden `PUT /admin/students/:id/warden`, hostel `PUT /admin/students/:id/hostel`, check-out `POST /admin/students/:id/checkout`, readmit `POST /admin/students/:id/readmit`, reset password `PUT /admin/users/:id/password`.
- Exit requests `GET /exit-requests`, approve/reject `PUT /exit-requests/:id/approve|reject`. Past students `GET /admin/past-students(/:id)`.
- Wardens `GET/POST /admin/wardens`, `GET/PUT/DELETE /admin/wardens/:id`, `PUT /admin/wardens/:id/password`, `PATCH /admin/wardens/:id/status`; security staff `GET /admin/security-staff`.
- Hostels `GET/POST /admin/hostels`, `PUT/DELETE /admin/hostels/:id`, `GET /admin/hostel-summary`. Tracking `GET /admin/tracking`.
- Rooms `GET /admin/rooms?hostel_id=`, `POST /admin/rooms`, `POST /admin/rooms/bulk`, `POST /admin/rooms/bulk-delete` (preview first, then `confirm: true`; occupied rooms are never deleted), `PUT/DELETE /admin/rooms/:id`. Keep: hostel tabs, floor groups, colour by Empty/Partly/Full, room details, multi-select delete.
- Attendance `GET/PUT /admin/attendance`, `PUT /admin/attendance/:studentId`, report `GET /admin/attendance/report`.
- Complaints `GET /complaints`, update `PUT /complaints/:id`, assign staff `PUT /complaints/:id/assign`. Maintenance staff `GET/POST /staff`, `PUT /staff/:id`.
- Outpasses `GET /outpasses`, `PUT /outpasses/:id/approve|reject`, `PUT /outpasses/:id`; manual gate entry `POST /outpasses/:id/manual`.
- Announcements `GET/POST /announcements`, `PUT/DELETE /announcements/:id` (optional photo, targeting). Mess menu `GET/PUT /mess/menu`.
- Emergency `GET/POST/PUT/DELETE /emergency/contacts`, SOS `GET /emergency/sos`, `PUT /emergency/sos/:id/acknowledge|resolve`. Visitors `GET /visitors`, `GET /visitors/summary`.

## Staff portal — warden pages (`/staff/warden/...`)
Dashboard `GET /warden/dashboard` (uses server `current_date`; wardens may only act on **today**), students `GET /warden/students(/:id)`, attendance `GET/PUT /warden/attendance`, `PUT /warden/attendance/:studentId` (hand-marked attendance is final), outpass requests `GET /outpasses/pending` + approve/reject, complaints, exit requests, announcements, emergency, visitors, currently outside, scan history. Server time: `GET /warden/time`.

## Gate portal (`/gate/security/...`) — security guards on phones
Big-button, one-hand, high-contrast UI. Dashboard `GET /security/today`; **Scan QR** (camera via `html5-qrcode`, `POST /outpasses/scan { qr_token }`, show a huge green ✓ OUT / ✓ IN or red ✗ result card with the student photo/name/room); manual entry `GET /outpasses/gate-lookup`, `POST /outpasses/:id/manual`; overdue `GET /outpasses/overdue`; currently outside `GET /security/currently-outside`; scan history `GET /security/scan-history`; visitors `POST /visitors`, `PUT /visitors/:id/checkout`; SOS alerts (`/emergency`).

## Developer console (`/developer/console`)
Developer-tool look (dark by default, monospace accents). Tabs: Overview `GET /developer/overview` (health, uptime, DB latency, counts), Users `GET/POST /developer/users`, `PATCH /developer/users/:id`, `PUT /developer/users/:id/password`, "open as user" `POST /developer/impersonate`, open portal `POST /developer/portal-token`, Audit log `GET /developer/audit`, Server errors `GET /developer/errors`. Keep the rule: dangerous actions require typing the user's email to confirm.

## Deliverable
Same routes, same API calls, same permissions — new professional look. `npm run build` must pass, and the build output must not contain the developer console.
