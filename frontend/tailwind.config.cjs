/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: '#081423',
        mist: '#d7e7ff',
        flare: '#ffd166',
        coral: '#ff6b6b',
      },
      boxShadow: {
        glow: '0 24px 80px rgba(13, 26, 57, 0.28)',
      },
      backgroundImage: {
        mesh:
          'radial-gradient(circle at top left, rgba(255,209,102,0.18), transparent 34%), radial-gradient(circle at 80% 20%, rgba(255,107,107,0.14), transparent 28%), linear-gradient(145deg, #07101d 0%, #0d1a31 48%, #102645 100%)',
      },
    },
  },
  plugins: [],
};
