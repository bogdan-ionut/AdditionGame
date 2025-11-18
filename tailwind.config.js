/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      keyframes: {
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        shine: {
          '0%': { transform: 'translateX(-100%) rotate(45deg)' },
          '100%': { transform: 'translateX(100%) rotate(45deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2s infinite',
        shine: 'shine 3s infinite ease-in-out',
        float: 'float 3s infinite ease-in-out',
        'spin-slow': 'spin 20s linear infinite',
      },
    },
  },
  plugins: [],
}
