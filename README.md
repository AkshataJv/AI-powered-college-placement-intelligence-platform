# CareerBridge AI — Placement & T&P Connect Platform

CareerBridge AI is a full-stack placement management platform for college campuses, supporting three role-based workspaces:

- **Student** — Profile, resume, certifications, skills, applications, roadmap, alumni mentorship
- **T&P Officer** — Drive management, analytics, student readiness dashboard, announcements
- **Alumni** — Profile directory, mentorship requests, mock interview slots, referrals

---

## Project Structure

```text
CareerBridge/
│
├── frontend/                  ← React/Vite source code
│   ├── public/                ← Static assets (favicon, icons)
│   │   ├── favicon.svg
│   │   └── icons.svg
│   ├── src/                   ← Application source
│   │   ├── assets/            ← Images and static files
│   │   ├── App.jsx            ← Main React component (all pages)
│   │   ├── App.css            ← Application styles
│   │   ├── api.js             ← API client (fetch wrapper, JWT, session)
│   │   ├── index.css          ← Global CSS reset
│   │   └── main.jsx           ← React entry point
│   ├── index.html             ← HTML entry point (Vite root)
│   ├── .env                   ← Local secrets (not committed)
│   └── .env.example           ← Environment variable template
│
├── server/                    ← Node.js / Express API (SQLite)
│   ├── index.js               ← Express routes, middleware, JWT auth
│   └── db.js                  ← SQLite schema + better-sqlite3 setup
│
├── backend/                   ← Python / FastAPI API (MySQL)
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            ← FastAPI entry point, CORS, routers
│   │   ├── database.py        ← SQLAlchemy engine + session
│   │   ├── dependencies.py    ← Auth & role dependencies
│   │   ├── auth/              ← JWT creation/decoding, password hashing
│   │   ├── models/            ← SQLAlchemy ORM models
│   │   ├── schemas/           ← Pydantic request/response schemas
│   │   └── routers/           ← FastAPI route handlers
│   ├── uploads/               ← Uploaded resume files (not in Git)
│   │   └── resumes/
│   ├── requirements.txt       ← Python dependencies
│   ├── .env                   ← Local secrets (not committed)
│   ├── .env.example           ← Environment variable template
│   └── README.md              ← Backend setup guide
│
├── database/                  ← Database documentation
│   ├── sqlite-schema.sql      ← SQLite schema (Node.js server)
│   ├── mysql-schema.sql       ← MySQL schema reference (FastAPI)
│   └── README.md              ← Database setup instructions
│
├── data/                      ← SQLite DB & uploads (not in Git)
│   ├── career-bridge.sqlite
│   └── uploads/
│
├── docs/                      ← Project documentation
│   ├── diagrams/
│   ├── reports/
│   ├── presentations/
│   └── project-notes/
│
├── dist/                      ← Vite build output (not in Git)
├── node_modules/              ← Node.js dependencies (not in Git)
├── package.json               ← Root Node.js config
├── vite.config.js             ← Vite config (root: frontend/)
├── .oxlintrc.json             ← ESLint (oxlint) config
├── .env                       ← Root .env for Node.js server
├── .env.example               ← Root .env template
├── .gitignore
└── README.md
```

---

## Quick Start

### Option A — Node.js Full Stack (SQLite)

The primary development setup uses Node.js + Express + SQLite for the API, and Vite for the React frontend.

**Requirements:** Node.js 20+

```powershell
# 1. Install dependencies
npm install

# 2. Configure environment
Copy-Item .env.example .env
# Edit .env and set a strong JWT_SECRET

# 3. Start API + Vite together
npm run dev

# Frontend: http://127.0.0.1:5173/
# API:      http://127.0.0.1:3001/api/
```

The SQLite database and uploaded files are written under `data/` (excluded from Git).

---

### Option B — Python FastAPI Backend (MySQL)

The FastAPI backend connects to a local MySQL database.

**Requirements:** Python 3.10+, MySQL Server 8.x

```powershell
# 1. Create MySQL database (run once in MySQL Workbench)
# CREATE DATABASE careerbridge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 2. Set up Python virtual environment
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 3. Configure environment
Copy-Item .env.example .env
# Edit backend/.env: set DATABASE_URL, SECRET_KEY, TP_CELL_INVITE_CODE

# 4. Start FastAPI
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Swagger docs: http://127.0.0.1:8000/docs
# Health check: http://127.0.0.1:8000/api/health
```

For the frontend to connect to FastAPI instead of the Node server, update `vite.config.js` proxy port from `3001` to `8000`.

---

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Node.js API (port 3001) + Vite (port 5173) together |
| `npm run server` | Start only the Node.js API server |
| `npm run build` | Production Vite build → `dist/` |
| `npm run lint` | Run oxlint on `frontend/src/` |
| `npm run preview` | Preview the production build |

---

## API Endpoints (Node.js Server)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Log in, receive JWT |
| GET | `/api/auth/me` | Current user profile |
| GET | `/api/drives` | List placement drives |
| POST | `/api/drives` | Create drive (T&P only) |
| POST | `/api/drives/:id/apply` | Apply to a drive (Student) |
| GET | `/api/alumni` | List alumni |
| GET | `/api/resumes/:id` | Download a resume |
| POST | `/api/students/resume` | Upload resume |
| GET/POST | `/api/certificates` | Student certifications |
| GET/POST | `/api/mentorship` | Mentorship requests |
| GET/POST | `/api/interview-slots` | Mock interview slots |
| POST | `/api/referrals` | Alumni referrals |
| GET/POST | `/api/forum` | Community forum |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, Vite 8, Vanilla CSS |
| Node.js API | Express 5, better-sqlite3, bcryptjs, JWT |
| FastAPI | Python, FastAPI, SQLAlchemy, PyMySQL, Argon2 |
| Databases | SQLite (dev/Node), MySQL 8 (FastAPI) |
| Auth | JWT (jsonwebtoken / python-jose) |

---

## Security Notes

- Never commit `.env` files — they contain `JWT_SECRET`, database passwords, and invite codes.
- Set `TP_CELL_INVITE_CODE` to a private value to prevent unauthorized T&P account creation.
- Resume files are stored outside the public web root and served only to authorized users.
- All passwords are hashed (bcrypt for Node.js, Argon2 for FastAPI).
