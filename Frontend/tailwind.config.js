/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  plugins: [],
  theme: {
    extend: {
      screens: {
        max1440: { max: '1440px' },
        max1642: { max: '1642px' },
      },
      boxShadow: {
        TableHeader: '0px 6px 30px -2px rgba(26, 26, 26, 0.05)',
        'table-box': '0px 10px 60px 0px rgba(226, 236, 249, 0.5)',
      },
      height: {
        11.25: '2.813rem',
      },
      padding: {
        5: '1.25rem',
      },
    },
  },
};
