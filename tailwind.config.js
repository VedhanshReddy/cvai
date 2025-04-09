/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}", // Optional, if you use components
  ],
  darkMode: 'class', // 👈 this enables dark mode based on a class (like <html class="dark">)
  theme: {
    extend: {
      fontFamily: {
        sans: ['Arial', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
