from fastapi import FastAPI, UploadFile, Form, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
import os
import tempfile
from PyPDF2 import PdfReader, PdfWriter
import zipfile
import re
import shutil
import math

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
    # Create a temporary directory
    temp_dir = tempfile.mkdtemp()
    try:
        # Sanitize the filename
        safe_filename = sanitize_filename(file.filename)
        
        # Save the uploaded file with sanitized name
        pdf_path = os.path.join(temp_dir, f"{safe_filename}.pdf")
        with open(pdf_path, "wb") as pdf_file:
            pdf_file.write(await file.read())
        
        # Read the PDF
        pdf = PdfReader(pdf_path)
        total_pages = len(pdf.pages)

        # Validate the split parameters
        is_valid, message, needs_confirmation = validate_split(total_pages, pages_per_split)
        if not is_valid:
            raise HTTPException(status_code=400, detail=message)

        # Create a zip file to store split PDFs
        zip_path = os.path.join(temp_dir, f"{safe_filename}_split.zip")
        with zipfile.ZipFile(zip_path, 'w') as zip_file:
            for start_page in range(0, total_pages, pages_per_split):
                # Create a new PDF writer
                output_pdf = PdfWriter()
                
                # Add pages to the writer
                end_page = min(start_page + pages_per_split, total_pages)
                for page_num in range(start_page, end_page):
                    output_pdf.add_page(pdf.pages[page_num])
                
                # Save the split PDF
                split_filename = f"{safe_filename}_part_{start_page//pages_per_split + 1}.pdf"
                split_path = os.path.join(temp_dir, split_filename)
                with open(split_path, "wb") as output_file:
                    output_pdf.write(output_file)
                
                # Add the split PDF to the zip file
                zip_file.write(split_path, split_filename)

        # Add cleanup task to background tasks
        background_tasks.add_task(remove_dir, temp_dir)

        # Return the zip file
        return FileResponse(
            zip_path,
            media_type="application/zip",
            filename=f"{safe_filename}_split.zip"
        )
    except HTTPException:
        # Clean up and re-raise HTTP exceptions
        shutil.rmtree(temp_dir)
        raise
    except Exception as e:
        # Clean up and raise other exceptions
        shutil.rmtree(temp_dir)
        raise HTTPException(status_code=500, detail=str(e)) 

@app.post("/api/validate-split")
async def validate_pdf_split(file: UploadFile, pages_per_split: int = Form(...)):
    # Create a temporary directory
    temp_dir = tempfile.mkdtemp()
    try:
        pdf_path = os.path.join(temp_dir, file.filename)
        with open(pdf_path, "wb") as pdf_file:
            pdf_file.write(await file.read())
        
        pdf = PdfReader(pdf_path)
        total_pages = len(pdf.pages)
        
        is_valid, message, needs_confirmation = validate_split(total_pages, pages_per_split)
        return {
            "isValid": is_valid,
            "message": message,
            "needsConfirmation": needs_confirmation,
            "totalPages": total_pages
        }
    finally:
        shutil.rmtree(temp_dir) 