# 🎓 CareerBridge AI
### AI-Powered College Placement Intelligence Platform

**Connecting students, alumni, and placement teams to make campus placements more organized, collaborative, and data-informed.**

CareerBridge AI is a full-stack college placement platform designed to bring placement activities, student profiles, career preparation, and alumni mentorship into one place.

Instead of keeping placement information scattered across different channels, the platform provides a shared workspace where students can explore opportunities, placement officers can manage recruitment drives, and alumni can support students through mentorship and referrals.

> 🚧 **Project status:** Under development. Features and integrations may evolve as the platform progresses.

---

## ✨ Key Features

### 👩‍🎓 Student Workspace
- **Student profiles:** Maintain skills, certifications, and career-related information.
- **Resume management:** Upload and access resumes.
- **Placement applications:** Explore placement drives and apply for eligible opportunities.
- **Alumni mentorship:** Request guidance and connect with alumni.
- **Career preparation:** Organize career goals and preparation activities.

### 🏢 Training & Placement (T&P) Workspace
- **Placement drive management:** Create and manage recruitment drives.
- **Student applications:** Support the placement application workflow.
- **Placement coordination:** Organize recruitment-related information and activities.
- **Readiness and analytics:** Provide a foundation for monitoring placement progress.

### 🤝 Alumni Workspace
- **Alumni directory:** Discover alumni profiles.
- **Mentorship requests:** Support student–alumni connections.
- **Mock interviews:** Manage interview slots.
- **Referral support:** Facilitate alumni referrals.

### 💡 AI-Powered Placement Intelligence — Project Direction
The platform is designed to support smarter, more personalized placement preparation. Potential extensions include:

- Placement readiness scoring
- Resume analysis and feedback
- Personalized skill-gap analysis
- Company-specific preparation roadmaps
- AI-powered interview practice
- Coding and aptitude recommendations
- Personalized study planning
- Data-driven placement insights

*These AI capabilities should be considered planned or evolving functionality unless they are implemented and tested in the current version.*

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite 8, CSS |
| Backend API | Node.js, Express 5 |
| Primary development database | SQLite |
| Alternative backend | Python, FastAPI, SQLAlchemy |
| Alternative database | MySQL 8 |
| Authentication | JWT-based authentication |
| Password security | bcryptjs / Argon2, depending on backend |
| Development tools | Git, GitHub, npm |

The repository contains both a Node.js/SQLite backend and a Python/FastAPI/MySQL backend. Follow the setup instructions for the backend you intend to run.

---

## 🏗️ Project Structure

```text
AI-powered-college-placement-intelligence-platform/
│
├── ai-service/          # AI-related services
├── backend/             # Python FastAPI backend
├── database/            # Database schemas and documentation
├── docs/                # Project documentation and notes
├── frontend/            # React frontend application
├── public/              # Public assets
├── scripts/             # Utility scripts
├── server/              # Node.js / Express API
├── src/                 # Root-level source files, if used
│
├── .env.example         # Environment variable template
├── .gitignore
├── package.json
├── vite.config.js
└── README.md
```

---

## 🚀 Getting Started

Follow these instructions to run the primary Node.js + SQLite development setup on your local machine.

### Prerequisites

Install the following:

- [Node.js](https://nodejs.org/) — version 20 or newer
- npm — included with Node.js
- [Git](https://git-scm.com/)

### 1. Clone the repository

```bash
git clone https://github.com/AkshataJv/AI-powered-college-placement-intelligence-platform.git
```

### 2. Navigate to the project

```bash
cd AI-powered-college-placement-intelligence-platform
```

### 3. Install dependencies

```bash
npm install
```

### 4. Configure environment variables

In Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and configure the required variables according to the project's environment template.

**Security:** Use a strong, private JWT secret. Never commit real credentials, API keys, database passwords, or private environment files to GitHub.

### 5. Start the application

```bash
npm run dev
```

When startup succeeds, the development services should be available at:

- **Frontend:** http://127.0.0.1:5173/
- **Node.js API:** http://127.0.0.1:3001/api/

Keep the terminal running while using the application.

---

## 🐍 Alternative Backend: FastAPI + MySQL

The repository also includes a Python backend for a MySQL-based setup.

### Prerequisites

- Python 3.10 or newer
- MySQL Server 8.x

### Setup

Create a MySQL database named `careerbridge`, then run the following in PowerShell:

```powershell
cd backend

python -m venv venv
.\venv\Scripts\Activate.ps1

pip install -r requirements.txt

Copy-Item .env.example .env
```

Configure the required database URL and secret values in `backend/.env`, then start the API:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

When the service starts successfully, the interactive API documentation should be available at:

http://127.0.0.1:8000/docs

Refer to the backend and database documentation for the configuration details specific to this setup.

---

## 📜 Available Commands

Run these commands from the project root:

| Command | Purpose |
|---|---|
| `npm install` | Install Node.js dependencies |
| `npm run dev` | Start the development services |
| `npm run server` | Start the Node.js API server |
| `npm run build` | Build the frontend for production |
| `npm run lint` | Check frontend code with the configured linter |
| `npm run preview` | Preview the production frontend build |

---

## 🔐 Security Considerations

- Keep `.env` files and credentials out of version control.
- Use strong secrets and appropriate authentication settings.
- Protect student profiles, resumes, and other personal information.
- Restrict sensitive operations according to user roles.
- Never publish private student data or production database files.
- Validate inputs and test authorization before deploying the platform.

---

## 🗺️ Future Improvements

Potential areas for further development include:

- More personalized AI-driven placement preparation
- Company-specific interview preparation resources
- Improved placement analytics and reporting
- Expanded alumni mentoring and knowledge sharing
- Automated readiness assessments and study plans
- Integrations with coding platforms and external placement resources

These are potential improvements, not a guarantee that every feature is currently available.

---

## 👩‍💻 About the Project

CareerBridge AI explores how full-stack engineering, data-driven insights, and AI-assisted workflows can improve the college placement experience.

**Developed by:** [Akshata Jadhav](https://github.com/AkshataJv)

**Repository:** [AI-powered College Placement Intelligence Platform](https://github.com/AkshataJv/AI-powered-college-placement-intelligence-platform)

---

## 📄 License

A license has not yet been specified. Please add an appropriate license before explicitly permitting others to reuse, modify, or distribute the project.
