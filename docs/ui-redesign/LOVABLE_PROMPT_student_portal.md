# Prompt for Lovable — Student portal (fancy, friendly UI)

Copy everything below the line into Lovable.

---

You are redesigning ONLY the **student portal UI** of an existing, working Hostel Management System. The backend API already exists and must not change. Do not create a new backend, database, Supabase project or auth system. Do not change any API calls' URLs, request bodies or response handling — only how things look and feel.

## Tech (keep exactly)
- React 19 + Vite + Tailwind CSS 3 + react-router-dom 7 + lucide-react icons + axios. You may add shadcn/ui components and framer-motion.
- The student app is mounted at the path **`/student`** (`BrowserRouter basename="/student"`). Entry: `src/portals/student/main.jsx`. Pages live in `src/pages/student/`, plus `src/pages/Login.jsx` (shared login) and `src/pages/Register.jsx`.
- **Do NOT edit**: `src/api/axios.js`, `src/context/AuthContext.jsx`, `src/portal.js`, `src/components/PrivateRoute.jsx`, `src/portals/PortalShell.jsx`, `vite.config.js`, anything under `src/pages/admin`, `src/pages/warden`, `src/pages/security`, `src/portals/staff`, `src/portals/gate`, `src/portals/developer`, or the `backend/` folder.
- Login behaviour must stay: `login(identifier, password, rememberMe)` from `useAuth()`; identifier may be an email or roll number; the "Keep me signed in on this device" checkbox; "Forgot password?" calls `POST /auth/forgot-password { identifier }` and shows the server's message; wrong-password and "too many attempts" (HTTP 429) messages come from the server — show them as they are.

## Design direction — "lovable"
Warm, friendly, modern student app that feels like a consumer app, not an office tool.
- Soft gradients (indigo → violet → pink accents), glassmorphism cards, rounded-2xl/3xl corners, generous spacing, playful but readable.
- Friendly greeting with first name and time of day ("Good evening, Ravi 🌙"), small celebratory micro-animations (framer-motion) on success (outpass approved, complaint resolved).
- Mobile-first: students mostly use phones. Bottom tab bar on mobile (Home, Outpass, Complaints, Notices, Profile); sidebar on desktop.
- Light and dark mode (respect system setting, with a toggle).
- Big, clear **Outpass QR** screen: full-width QR, brightness hint, status chip, countdown to return time; must still work offline from the cached copy (keep the existing offline QR logic in `src/utils/offlineQr.js`).
- Skeleton loaders instead of spinners, friendly empty states with illustrations/emoji, toasts for success/error.
- Accessible: 4.5:1 contrast, visible focus, labels on every input, tap targets ≥ 44px.
- Footer text must remain: "Designed by Jithendra".

## Pages to redesign (keep every feature that exists today)
1. **Login / Register** (`/student/login`, `/student/register`).
2. **Dashboard** (`/dashboard`): profile summary (name, roll no, room, course), stats (complaints, outpasses), recent complaints & outpasses, **Emergency Help card with a big SOS button** (`POST /emergency/sos`, contacts from `GET /students/contacts` or `GET /emergency/contacts`), today's mess menu (`GET /mess/menu`).
3. **Profile** (`/profile`): view/edit via `PUT /students/profile`; change password modal (`PUT /auth/password`).
4. **Complaints** (`/complaints`): list `GET /complaints`, create `POST /complaints` (category, description, optional photo), cancel `PUT /complaints/:id/cancel`, reopen `PUT /complaints/:id/reopen`, rate `PUT /complaints/:id/rate` — show a clear status timeline (Pending → In Progress → Resolved).
5. **Outpasses** (`/outpasses`): list `GET /outpasses/my`, apply `POST /outpasses` (type Outing/Home, reason, destination, leave & return date-time in India time, parent consent), view QR `GET /outpasses/:id/qr` for Approved / Checked Out passes.
6. **Announcements** (`/announcements`): `GET /announcements`, may include a photo.
7. **Help** (`/help`) and the **notification bell** (`GET /notifications`, `PUT /notifications/:id/read`, `PUT /notifications/read-all`).
8. Exit request (leaving the hostel permanently) if shown today: `GET/POST /exit-requests`, `PUT /exit-requests/:id/cancel`.

All calls go through the existing `api` instance from `src/api/axios.js` (it adds the token and handles 401).

## Deliverable
Same routes, same data, same behaviour — new look. After changes, `npm run build` must pass with no errors.
