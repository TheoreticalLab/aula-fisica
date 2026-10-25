/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}', './pruebas/vista-previa/*.{html,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Identidad: azul institucional y dorado académico
        primario: {
          50: '#eef3fb',
          100: '#d7e2f4',
          200: '#afc4e8',
          300: '#7f9fd6',
          400: '#5079c0',
          500: '#335ca6',
          600: '#264886',
          700: '#1e3a6c',
          800: '#18305a',
          900: '#14284b',
          950: '#0b1730',
        },
        acento: {
          100: '#fbf0d5',
          200: '#f5dea6',
          300: '#eec770',
          400: '#e3ad42',
          500: '#c99325',
          600: '#a5741b',
          700: '#7d5718',
        },
        papel: '#f7f6f2',
        tinta: '#1d2433',
        noche: '#0d1424',
      },
      fontFamily: {
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
        sans: ['system-ui', '-apple-system', '"Segoe UI"', 'Roboto', '"Noto Sans"', 'Ubuntu', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
