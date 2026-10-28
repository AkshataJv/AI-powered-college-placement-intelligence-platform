import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file from ai-service root if present
env_path = Path(__file__).resolve().parent.parent / '.env'
if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()

SERVICE_PORT = int(os.getenv("SERVICE_PORT", "8000"))
SERVICE_HOST = os.getenv("SERVICE_HOST", "127.0.0.1")
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://127.0.0.1:3001")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

raw_origins = os.getenv(
    "ALLOWED_ORIGINS",
    "http://127.0.0.1:3001,http://localhost:3001,http://127.0.0.1:5173,http://localhost:5173"
)
ALLOWED_ORIGINS = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
