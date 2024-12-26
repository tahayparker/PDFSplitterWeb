from fastapi import FastAPI, UploadFile, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
from PyPDF2 import PdfReader, PdfWriter
import zipfile
import re
import shutil
import math
import uvicorn
import logging
import traceback
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://PDFSplitter.vercel.app", "http://localhost:3000", "http://localhost:10000", "0.0.0.0:10000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
@app.head("/")
async def root():
    return JSONResponse(content={"status": "ok"})

def sanitize_filename(filename: str) -> str:
    # Remove file extension
    filename = os.path.splitext(filename)[0]
    # Replace special characters with underscores
    sanitized = re.sub(r'[^a-zA-Z0-9-]', '_', filename)
    # Remove multiple consecutive underscores
    sanitized = re.sub(r'_+', '_', sanitized)
    # Trim underscores from start and end
    sanitized = sanitized.strip('_')
    # Limit length
    sanitized = sanitized[:50]
    return sanitized

def remove_dir(path: str):
    try:
        shutil.rmtree(path)
    except:
        pass

def validate_split(total_pages: int, pages_per_split: int) -> tuple[bool, str, bool]:
    """
    Validate if the PDF can be split with the given parameters
    Returns (is_valid: bool, message: str, needs_confirmation: bool)
    """
    if total_pages < pages_per_split:
        return False, f"PDF has {total_pages} pages but requested {pages_per_split} pages per split", False
    
    num_splits = math.ceil(total_pages / pages_per_split)
    remaining_pages = total_pages % pages_per_split
    
    if remaining_pages == 0:
        return True, f"PDF will be split into {num_splits} equal parts of {pages_per_split} pages", False
    else:
        last_split_pages = remaining_pages
        return True, f"PDF will be split into {num_splits} parts of {pages_per_split} pages each. Last part will have {last_split_pages} pages instead of {pages_per_split} pages", True

@app.post("/api/split-pdf")
async def split_pdf(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    pages_per_split: int = Form(...)
):
    logger.info(f"Starting PDF split - File: {file.filename}, Pages per split: {pages_per_split}")
    temp_dir = tempfile.mkdtemp()
    try:
        safe_filename = sanitize_filename(file.filename)
        logger.info(f"Sanitized filename: {safe_filename}")
        
        pdf_path = os.path.join(temp_dir, f"{safe_filename}.pdf")
        with open(pdf_path, "wb") as pdf_file:
            pdf_file.write(await file.read())
        
        logger.info("PDF file saved to temporary location")
        
        pdf = PdfReader(pdf_path)
        total_pages = len(pdf.pages)
        logger.info(f"PDF loaded - Total pages: {total_pages}")

        is_valid, message, needs_confirmation = validate_split(total_pages, pages_per_split)
        if not is_valid:
            logger.error(f"Invalid split parameters: {message}")
            raise HTTPException(status_code=400, detail=message)

        zip_path = os.path.join(temp_dir, f"{safe_filename}_split.zip")
        with zipfile.ZipFile(zip_path, 'w') as zip_file:
            for start_page in range(0, total_pages, pages_per_split):
                end_page = min(start_page + pages_per_split, total_pages)
                logger.info(f"Processing pages {start_page + 1} to {end_page}")
                
                output_pdf = PdfWriter()
                for page_num in range(start_page, end_page):
                    output_pdf.add_page(pdf.pages[page_num])
                
                split_filename = f"{safe_filename}_part_{start_page//pages_per_split + 1}.pdf"
                split_path = os.path.join(temp_dir, split_filename)
                with open(split_path, "wb") as output_file:
                    output_pdf.write(output_file)
                
                zip_file.write(split_path, split_filename)
                logger.info(f"Added {split_filename} to zip")

        logger.info("PDF split completed successfully")
        background_tasks.add_task(remove_dir, temp_dir)
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=f"{safe_filename}_split.zip"
        )
    except Exception as e:
        logger.error(f"Error splitting PDF: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        shutil.rmtree(temp_dir)
        if isinstance(e, HTTPException):
            raise
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/validate-split")
async def validate_pdf_split(file: UploadFile, pages_per_split: int = Form(...)):
    logger.info(f"Validating PDF split - File: {file.filename}, Pages per split: {pages_per_split}")
    temp_dir = tempfile.mkdtemp()
    try:
        pdf_path = os.path.join(temp_dir, file.filename)
        with open(pdf_path, "wb") as pdf_file:
            while chunk := await file.read(8192):
                pdf_file.write(chunk)
        
        logger.info(f"File saved to temporary location: {pdf_path}")
        
        with open(pdf_path, "rb") as f:
            pdf = PdfReader(f)
            total_pages = len(pdf.pages)
            logger.info(f"PDF loaded successfully - Total pages: {total_pages}")
        
        is_valid, message, needs_confirmation = validate_split(total_pages, pages_per_split)
        logger.info(f"Validation result - Valid: {is_valid}, Message: {message}, Needs confirmation: {needs_confirmation}")
        
        return {
            "isValid": is_valid,
            "message": message,
            "needsConfirmation": needs_confirmation,
            "totalPages": total_pages
        }
    except Exception as e:
        logger.error(f"Error validating PDF: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise
    finally:
        shutil.rmtree(temp_dir)
        logger.info("Temporary directory cleaned up")

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 10000)),
        proxy_headers=True,
        forwarded_allow_ips="*"
    ) 