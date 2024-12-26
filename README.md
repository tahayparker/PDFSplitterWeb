# PDF Splitter

A modern web application for splitting PDF files into smaller documents with equal page counts.

## Features

- **Modern Interface**: Clean, responsive UI with light/dark theme support
- **Secure Processing**: Server-side PDF processing with FastAPI
- **File Safety**: Warns before uneven splits
- **Smart Splitting**: Suggests optimal split sizes for uneven page distribution
- **Real-time Feedback**: Visual status indicators and confirmations
- **Download Management**: Delivers split PDFs in a convenient zip file

## Tech Stack

### Frontend
- Next.js
- TypeScript
- Tailwind CSS

### Backend
- FastAPI
- PyPDF2
- Python 3.x

## Installation

1. Install frontend dependencies:

```bash
cd frontend
npm install
```

2. Install backend dependencies:

```bash
cd backend
pip install -r requirements.txt
```

## Development

1. Start the frontend development server:

```bash
cd frontend
npm run dev
```

2. Start the backend server:

```bash
cd backend
uvicorn main:app --reload
```

The application will be available at `http://localhost:3000`

## Usage

1. Select the number of pages you want per split
2. Upload your PDF file
3. Confirm the split configuration if needed
4. Download the zip file containing your split PDFs

The application will:
- Validate your input PDF
- Check if the split size evenly divides the total pages
- Warn you about uneven splits
- Create a zip file containing the split PDFs

## Limitations

- File format: PDF only
- Requires both frontend and backend servers running
- Backend processes files in memory

## Security Features

- Server-side file processing
- Sanitized filenames
- Temporary file cleanup
- No file system persistence
- CORS protection
- Memory-efficient processing

## Notes

- The application suggests optimal split configurations for uneven page counts
- Dark/light theme support with system preference detection
- All split operations are reversible (original file is never modified)
- Split PDFs are delivered in a single zip file for convenience