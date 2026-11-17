const colors = require('tailwindcss/colors')

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}', './lib/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Brand accent: the app's "emerald" classes render in the sky/navy identity (Abdullah's colour rule).
      // Green (`green-*`) stays reserved for main meals; department colours map emerald to green in lib/departments.js.
      colors: { emerald: colors.sky, navy: { DEFAULT: '#081c44', 700: '#0b2a63' } },
    },
  },
  plugins: [],
}
