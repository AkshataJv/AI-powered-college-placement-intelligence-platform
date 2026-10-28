# CareerBridge AI Service

Standalone Python FastAPI microservice for AI-powered resume parsing, semantic matching, skill gap analysis, and placement prediction.

> **Important Architecture Rule:**  
> This service must be started separately from the Node backend. It communicates only via HTTP.  
> It does **NOT** connect to SQLite or the database directly. All data is received as JSON/multipart HTTP requests from the Node backend and returned as structured JSON responses.

---

## 1. Setup

Navigate to the `ai-service/` folder:

```powershell
cd "d:\Storage Data\PBL5\ai-service"
```

Activate the virtual environment:

```powershell
.\venv\Scripts\Activate.ps1
```

Install dependencies:

```powershell
pip install -r requirements.txt
```

---

## 2. Running the Microservice

Start Uvicorn with auto-reload:

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

- **Interactive API Documentation (Swagger UI):** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Alternative Documentation (ReDoc):** [http://127.0.0.1:8000/redoc](http://127.0.0.1:8000/redoc)
- **Health Check Endpoint:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)

---

## 3. Available Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/` | Welcome message with links to documentation and health check |
| `GET` | `/health` | Service health status and ISO timestamp |
| `POST` | `/parse-resume` | Stateless multipart upload extracting text, skills, education, & experience from PDF |

---

## 4. Running Tests

Run the test suite with pytest:

```powershell
pytest
```
