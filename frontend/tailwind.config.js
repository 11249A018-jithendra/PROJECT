/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: { sans: ['DM Sans', 'system-ui', 'sans-serif'] },
      colors: {
        indigo: {
          50: '#f2efff', 100: '#e7e1ff', 200: '#d2c7ff', 300: '#b4a1fa',
          400: '#9377ed', 500: '#7959df', 600: '#6846d1', 700: '#5738b5',
          800: '#462e90', 900: '#392774', 950: '#24184e',
        },
      },
    },
  },
  plugins: [],
}

