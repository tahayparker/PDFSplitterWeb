import { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export default function Home() {
  const [pagesPerSplit, setPagesPerSplit] = useState('1');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Auto-reset error, success, and cancelled states after 5 seconds
  useEffect(() => {
    if (error || success || cancelled) {
      const timer = setTimeout(() => {
        if (error) setError(null);
        if (success) setSuccess(null);
        if (cancelled) setCancelled(false);
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [error, success, cancelled]);

  useEffect(() => {
    // Initialize theme state
    setIsDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  const handlePagesPerSplitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    if (value < 1) {
      setPagesPerSplit('1');
    } else {
      setPagesPerSplit(e.target.value);
    }
  };

  const validateAndUpload = async (file: File) => {
    setIsValidating(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pages_per_split', pagesPerSplit);

    try {
      const response = await axios.post(
        'https://pdfsplitterweb.onrender.com/api/validate-split', 
        formData,
        {
          timeout: 60000, // 60 second timeout
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        }
      );
      const { isValid, message, needsConfirmation } = response.data;

      if (!isValid) {
        setError(message);
        return;
      }

      if (needsConfirmation) {
        setConfirmationMessage(message);
        setShowConfirmation(true);
        setPendingFile(file);
        return;
      }

      // If no confirmation needed, proceed with upload
      await processSplit(file);
    } catch (err) {
      if (axios.isAxiosError(err) && err.code === 'ECONNABORTED') {
        setError('Validation request timed out. Please try again.');
      } else {
        setError('Error validating PDF file.');
      }
      console.error(err);
    } finally {
      setIsValidating(false);
    }
  };

  const processSplit = async (file: File) => {
    setIsLoading(true);
    setShowConfirmation(false); // Hide popup immediately
    setPendingFile(null);
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('pages_per_split', pagesPerSplit);

    try {
      const response = await axios.post('http://localhost:8000/api/split-pdf', formData, {
        responseType: 'blob',
      });

      const baseFilename = file.name.replace(/\.pdf$/i, '');
      const zipFilename = `${baseFilename}_split.zip`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', zipFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      setSuccess('PDF split successfully! Downloading zip file...');
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data) {
        // Convert blob error response to text
        const blob = new Blob([err.response.data]);
        const text = await blob.text();
        try {
          const errorData = JSON.parse(text);
          setError(errorData.detail || 'An error occurred while splitting the PDF.');
        } catch {
          setError('An error occurred while splitting the PDF.');
        }
      } else {
        setError('An error occurred while splitting the PDF.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    
    const file = e.target.files[0];
    setSelectedFile(file);
    setError(null);
    setWarning(null);
    setSuccess(null);

    if (!pagesPerSplit || pagesPerSplit === '0') {
      setWarning('Please specify the number of pages per split');
      return;
    }

    await validateAndUpload(file);
  };

  const handleReset = () => {
    setPagesPerSplit('1');
    setSelectedFile(null);
    setError(null);
    setWarning(null);
    setSuccess(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleCancelSplit = () => {
    setShowConfirmation(false);
    setPendingFile(null);
    setCancelled(true);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    // Reset cancelled state after 5 seconds
    setTimeout(() => setCancelled(false), 5000);
  };

  const getCalloutContent = () => {
    if (error) {
      return {
        type: 'error',
        style: 'bg-red-100/80 border-red-600 dark:bg-red-950/50',
        content: (
          <>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7.5 0C3.36 0 0 3.36 0 7.5C0 11.64 3.36 15 7.5 15C11.64 15 15 11.64 15 7.5C15 3.36 11.64 0 7.5 0ZM11.25 10.185L10.185 11.25L7.5 8.565L4.815 11.25L3.75 10.185L6.435 7.5L3.75 4.815L4.815 3.75L7.5 6.435L10.185 3.75L11.25 4.815L8.565 7.5L11.25 10.185Z"
                fill="#991B1B"
                className="dark:fill-red-500"
              />
            </svg>
            <p className="text-red-900 dark:text-red-200 ml-2">{error}</p>
          </>
        )
      };
    }
    if (cancelled) {
      return {
        type: 'info',
        style: 'bg-gray-100/80 border-gray-600 dark:bg-gray-950/50',
        content: (
          <>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7.5 0C3.36 0 0 3.36 0 7.5C0 11.64 3.36 15 7.5 15C11.64 15 15 11.64 15 7.5C15 3.36 11.64 0 7.5 0ZM6.75 3.75H8.25V8.25H6.75V3.75ZM6.75 9.75H8.25V11.25H6.75V9.75Z"
                fill="#4B5563"
                className="dark:fill-gray-400"
              />
            </svg>
            <p className="text-gray-900 dark:text-gray-300 ml-2">Split operation cancelled</p>
          </>
        )
      };
    }
    if (warning) {
      return {
        type: 'warning',
        style: 'bg-yellow-100/80 border-yellow-600 dark:bg-yellow-950/50',
        content: (
          <>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7.5 0C3.36 0 0 3.36 0 7.5C0 11.64 3.36 15 7.5 15C11.64 15 15 11.64 15 7.5C15 3.36 11.64 0 7.5 0ZM6.75 3.75H8.25V8.25H6.75V3.75ZM6.75 9.75H8.25V11.25H6.75V9.75Z"
                fill="#854D0E"
                className="dark:fill-yellow-500"
              />
            </svg>
            <p className="text-yellow-900 dark:text-yellow-200 ml-2">{warning}</p>
          </>
        )
      };
    }
    if (success) {
      return {
        type: 'success',
        style: 'bg-green-100/80 border-green-600 dark:bg-green-950/50',
        content: (
          <>
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M7.5 0C3.36 0 0 3.36 0 7.5C0 11.64 3.36 15 7.5 15C11.64 15 15 11.64 15 7.5C15 3.36 11.64 0 7.5 0ZM6 11.25L2.25 7.5L3.315 6.435L6 9.12L11.685 3.435L12.75 4.5L6 11.25Z"
                fill="#064E3B"
                className="dark:fill-green-500"
              />
            </svg>
            <p className="text-green-900 dark:text-green-200 ml-2">{success}</p>
          </>
        )
      };
    }
    if (selectedFile) {
      return {
        type: 'processing',
        style: 'bg-emerald-100/80 border-emerald-600 dark:bg-emerald-950/50',
        content: (
          <p className="text-emerald-900 dark:text-emerald-200">Processing: {selectedFile.name}</p>
        )
      };
    }
    return null;
  };

  const callout = getCalloutContent();

  const toggleTheme = () => {
    const isLight = document.documentElement.classList.contains('light');
    if (isLight) {
      localStorage.theme = 'dark';
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      setIsDarkMode(true);
    } else {
      localStorage.theme = 'light';
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      setIsDarkMode(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col page-transition">
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="p-2 rounded-full border-2 border-[#482f1f] hover:border-[#006D5B] transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-6 h-6 transition-transform duration-500 ease-in-out transform hover:rotate-12"
            style={{ transform: `rotate(${isDarkMode ? 180 : 0}deg)` }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d={isDarkMode
                ? "M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                : "M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"}
            />
          </svg>
        </button>
      </div>

      <main className="flex-grow w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-24 flex items-center justify-center">
        <div className="w-full max-w-3xl mx-auto text-center">
          <div 
            className="mb-16"
            style={{ animation: 'fadeSlideIn 0.8s ease-out' }}
          >
            <h1 className="text-4xl font-bold mb-4">
              Welcome to <span className="font-parkinsans bg-clip-text text-transparent bg-gradient-to-r from-[#006D5B] to-emerald-400">
                PDF Splitter
              </span>
            </h1>
            <p className="text-xl">
              Split your PDF documents with ease
            </p>
          </div>

          <div className="space-y-16">
            <div className="flex items-center justify-center gap-4">
              <label className="text-2xl font-medium whitespace-nowrap">Pages per split:</label>
              <input
                type="number"
                min="1"
                value={pagesPerSplit}
                onChange={handlePagesPerSplitChange}
                onBlur={() => {
                  if (!pagesPerSplit || parseInt(pagesPerSplit) < 1) {
                    setPagesPerSplit('1');
                  }
                }}
                className="w-24 px-4 py-2 border-2 border-[#482f1f] rounded-md bg-transparent transition-all duration-200 hover:border-[#006D5B] focus:border-[#006D5B] focus:outline-none focus:ring-0 appearance-none text-2xl text-center"
              />
            </div>

            <div className="flex gap-4 justify-center">
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className={`${
                    isLoading || isValidating ? 'opacity-50 cursor-not-allowed' : 'glow-button'
                  } px-10 py-4 border-2 rounded-full transition-all duration-200 min-w-[200px] text-lg cursor-pointer inline-block`}
                >
                  {isLoading ? 'Processing...' : isValidating ? 'Validating...' : 'Upload & Split PDF'}
                </label>
              </div>
              <button
                onClick={handleReset}
                className="glow-button-red px-10 py-4 border-2 rounded-full transition-all duration-200 min-w-[200px] text-lg"
              >
                Reset
              </button>
            </div>

            {callout && (
              <div className={`mt-4 p-4 rounded-md ${callout.style} border-l-4 animate-[slideIn_0.3s_ease-out]`}>
                <div className="flex items-center justify-start text-left">
                  {callout.content}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {showConfirmation && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div 
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={handleCancelSplit}
          />
          <div className="p-8 rounded-lg border-2 border-[#482f1f] max-w-md w-full mx-4 relative z-10 popup-bg">
            <h3 className="text-2xl font-bold mb-4 text-black dark:text-white">Confirm Split</h3>
            <p className="text-black dark:text-white mb-8 font-medium">{confirmationMessage}</p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={handleCancelSplit}
                className="glow-button-red px-6 py-3 border-2 rounded-full transition-all duration-200 min-w-[120px] text-base"
              >
                Cancel
              </button>
              <button
                onClick={() => pendingFile && processSplit(pendingFile)}
                className="glow-button px-6 py-3 border-2 rounded-full transition-all duration-200 min-w-[120px] text-base"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 