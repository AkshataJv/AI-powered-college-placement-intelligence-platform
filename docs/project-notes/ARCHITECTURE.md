# CareerBridge AI — Project Notes

## Architecture Decisions

### Dual Backend Strategy
The project contains **two independent backends**:

1. **Node.js + Express + SQLite** (`server/`) — The primary, fully-functional backend used by default with `npm run dev`. Uses SQLite for zero-setup local development.

2. **Python + FastAPI + MySQL** (`backend/`) — A parallel backend implementation using MySQL. Requires MySQL Server 8.x and Python 3.10+. Start with `uvicorn app.main:app --reload` from the `backend/` directory.

Both backends expose the same API contract under `/api/...` so the frontend (`frontend/src/api.js`) works with either, once the Vite proxy is pointed at the correct port.

### Frontend Organization
All React/Vite source lives under `frontend/`:
- `frontend/src/App.jsx` — monolithic SPA component (all pages in one file)
- `frontend/src/api.js` — fetch wrapper with JWT session management
- `frontend/src/App.css` — all styles in one file

Future refactoring could split `App.jsx` into:
```
frontend/src/
├── pages/          (Login, Register, StudentDashboard, etc.)
├── components/     (Header, Sidebar, Cards, etc.)
├── hooks/          (useAuth, useApi, etc.)
└── context/        (AuthContext, etc.)
```

### Vite Root Configuration
`vite.config.js` at the project root sets `root: 'frontend/'` so:
- Vite reads `frontend/index.html` as the HTML entry point
- `frontend/public/` serves static assets
- `frontend/src/` contains the React application
- Build output goes to `dist/` at the project root
- `node_modules/` stays at the project root (shared by Vite + Node.js server)

### Database Files
- SQLite database: `data/career-bridge.sqlite` (excluded from Git)
- MySQL: managed by SQLAlchemy in the FastAPI backend
- Schema docs: `database/sqlite-schema.sql` and `database/mysql-schema.sql`

## Known Issues / Notes

- `better-sqlite3` requires native compilation (C++ build tools) on Windows. If `npm install` fails, install Visual Studio Build Tools with the "Desktop development with C++" workload.
- The backend `venv/` and `.venv/` directories are excluded from Git.
- `backend/.env` has a duplicate `TP_CELL_INVITE_CODE` key — only the last value is used by Python's `dotenv`.

## Feature Status

| Feature | Node.js Backend | FastAPI Backend |
|---------|----------------|-----------------|
| Auth (register/login/JWT) | ✅ | ✅ |
| Student profile | ✅ | ✅ |
| Resume upload/download | ✅ | ✅ |
| Certificates | ✅ | ✅ |
| Skills | ✅ | ✅ |
| Placement drives/companies | ✅ | ✅ |
| Applications | ✅ | ✅ |
| Alumni directory | ✅ | ✅ |
| Mentorship | ✅ | ✅ |
| Mock interviews | ✅ | ❌ (not yet) |
| Referrals | ✅ | ❌ (not yet) |
| Forum | ✅ | ❌ (not yet) |
| Roadmap | ❌ | ✅ |
| Announcements | ❌ | ✅ |
| T&P Analytics | ❌ | ✅ |
| AI Match Score | ✅ | ❌ (planned) |
