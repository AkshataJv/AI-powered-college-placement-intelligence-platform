import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse
from app.services.resume_parser import ResumeParser

logger = logging.getLogger("careerbridge-ai.resume_router")

router = APIRouter(tags=["Resume"])
parser = ResumeParser()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
ALLOWED_CONTENT_TYPES = {"application/pdf", "application/x-pdf"}


@router.post("/parse-resume")
async def parse_resume(file: UploadFile = File(...)):
    """
    In-memory resume PDF parsing endpoint.
    Validates file extension, content-type, and size before extracting
    skills, education, and experience.
    """
    # Validate extension
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file type. Only PDF files (.pdf) are allowed.",
        )

    # Validate content-type
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid Content-Type '{file.content_type}'. Expected PDF mime type.",
        )

    try:
        file_bytes = await file.read()
    except Exception as exc:
        logger.error("Failed to read uploaded file: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": "Could not parse resume", "detail": "Failed to read file data."},
        )

    # Validate file size
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds the 10 MB limit.",
        )

    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded PDF file is empty.",
        )

    try:
        result = parser.parse(file_bytes)
        if "error" in result:
            return JSONResponse(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                content={"error": "Could not parse resume", "detail": result["error"]},
            )
        return result
    except Exception as exc:
        logger.exception("Unexpected error during resume parsing: %s", exc)
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": "Could not parse resume", "detail": str(exc)},
        )
