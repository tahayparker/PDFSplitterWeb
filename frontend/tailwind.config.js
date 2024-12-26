/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#121212',
        foreground: '#ffffff',
      },
      fontFamily: {
        parkinsans: ['Parkinsans', 'sans-serif'],
      },
    },
  },
  plugins: [],
  darkMode: 'class',
} 