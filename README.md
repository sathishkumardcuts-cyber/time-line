# Enterprise Timesheet Management System

Full-stack enterprise timesheet app with Vite frontend and Node.js/Express backend.

## Features

- Google-ready login endpoint plus JWT login/logout/session validation
- Role-based access control for Admin and Employee users
- Admin-only dashboard, reports, attendance, settings, exports, employee views
- Employee-only protected timesheet page and own employee card
- REST API for auth, employees, timesheets, reports, attendance, settings
- Secure middleware: Helmet, CORS, rate limiting, HTTP-only cookie support, validation
- Dark glassmorphism UI, responsive sidebar/topbar, calendar, cards, tables
- JSON persistence for immediate local use; backend is structured so MongoDB/Mongoose can replace `src/db.js`

## Test Accounts

- Admin: `admin@pulsedesk.test` / `password123`
- Employee: `employee@pulsedesk.test` / `password123`

## Run Locally

1. Copy `.env.example` to `.env` inside `backend`.
2. Copy `.env.example` to `.env` inside `frontend`.
3. From this folder run `npm run install:all`.
4. In one terminal run `npm run dev:backend`.
5. In another terminal run `npm run dev:frontend`.
6. Open `http://localhost:5173`.

## Production Notes

- Replace `JWT_SECRET` with a long random secret.
- Add a real `GOOGLE_CLIENT_ID` and verify Google ID tokens server-side for production OAuth.
- Replace JSON storage with MongoDB/Mongoose or Firebase Firestore before deploying multi-user production workloads.
- Configure HTTPS, secure cookies, CSRF strategy, and production CORS origins on the deployed domains.
