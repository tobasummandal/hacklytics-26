/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        magic: '#9333ea',
        politics: '#dc2626',
        technology: '#2563eb',
        economy: '#16a34a',
        culture: '#f59e0b',
        character: '#ec4899',
      }
    },
  },
  plugins: [],
}
