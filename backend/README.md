# CareerBridge FastAPI Backend

This backend uses FastAPI, SQLAlchemy, MySQL/PyMySQL, Pydantic, JWT, and Argon2 password hashing. It creates missing tables on startup but never drops or resets existing tables or data. It does not seed demo records.

## Requirements

- Python 3.10 or newer (tested with Python 3.14)
- MySQL Server 8.x running locally; MySQL Workbench is the client used to create/manage the database

## 1. Create the MySQL database in Workbench

Connect to the local MySQL Server at `localhost:3306` as `root`, open a SQL tab, and run:

```sql
CREATE DATABASE careerbridge
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
```

This creates only the database. SQLAlchemy creates missing tables when FastAPI starts.

## 2. Configure the backend environment

In a VS Code PowerShell terminal from the project root, edit the generated `backend/.env` template. If it was removed, copy the example first:

```powershell
Set-Location .\backend
if (-not (Test-Path .\.env)) { Copy-Item .env.example .env }
notepad .\.env
```

Open `backend/.env` and replace `YOUR_MYSQL_PASSWORD` with the local MySQL root password. Do not commit `.env`; it is ignored by Git. If the password contains URL-reserved characters, URL-encode them in `DATABASE_URL` (for example, `@` becomes `%40`). Replace `CHANGE_THIS_SECRET_KEY` with a long random value as well.

Set `TP_CELL_INVITE_CODE` to a private value and include that value as `tp_cell_invite_code` when registering a `tp_cell` account. This prevents public self-registration from granting T&P permissions.

Example format (placeholder only):

```dotenv
DATABASE_URL=mysql+pymysql://root:YOUR_MYSQL_PASSWORD@localhost:3306/careerbridge
SECRET_KEY=CHANGE_THIS_SECRET_KEY
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

## 3. Create a virtual environment and install packages

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

If PowerShell blocks environment activation, run this once in the current terminal and activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

## 4. Start FastAPI

From the `backend` directory, with the virtual environment active:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Open Swagger at `http://127.0.0.1:8000/docs`, ReDoc at `http://127.0.0.1:8000/redoc`, and the health check at `http://127.0.0.1:8000/api/health`.

The health check executes `SELECT 1`. If `.env` is missing or MySQL is unavailable, the API reports a clear 503 response while the documentation remains available for troubleshooting.

## 5. Register and log in

In Swagger, open `POST /api/auth/register`, select **Try it out**, and send a new account. Use one of the three supported roles: `student`, `alumni`, or `tp_cell`.

```json
{
  "name": "Your Name",
  "email": "you@example.com",
  "password": "ChooseYourOwnPassword",
  "role": "student"
}
```

Then use `POST /api/auth/login`:

```json
{
  "email": "you@example.com",
  "password": "ChooseYourOwnPassword"
}
```

Copy the returned `access_token` into Swagger's **Authorize** dialog as a Bearer token. `GET /api/auth/me` verifies the current account. User roles cannot be changed through profile APIs.

## Resume storage

Resume files are limited to PDF, DOC, and DOCX up to 10 MB and are stored under `backend/uploads/resumes/`; MySQL stores only their metadata and path. Students can manage only their own resumes. T&P resume access is authorized through a placement application. Uploaded files and `.env` are excluded from Git.

## API groups

- Authentication: register, login, current account
- Students: profile, skills, resumes, roadmap, applications
- Alumni: profile directory and mentorship
- Companies: listing and T&P management
- Applications: apply, view own applications, T&P decisions
- Announcements: student/alumni read access and T&P management
- T&P Cell: students, companies, applications, announcements, and analytics

Future resume analysis and mentor assistance can be added as services without storing uploaded file contents in MySQL. No AI behavior or generated placement data is included yet.