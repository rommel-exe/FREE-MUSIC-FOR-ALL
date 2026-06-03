/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#0A84FF',
          100: '#0A84FF',
          200: '#409CFF',
          300: '#72B8FF',
          400: '#99CCFF',
          500: '#0A84FF',
          600: '#0070E0',
          700: '#005BBB',
          800: '#004A99',
          900: '#003A78',
          950: '#002A57',
        },
        surface: {
          50: '#FFFFFF',
          100: '#EBEBF5',
          200: '#C7C7CC',
          300: '#AEAEB2',
          400: '#8E8E93',
          500: '#636366',
          600: '#48484A',
          700: '#3A3A3C',
          800: '#2C2C2E',
          900: '#1C1C1E',
          950: '#0A0A0A',
        },
        mac: {
          blue: '#0A84FF',
          green: '#30D158',
          red: '#FF453A',
          orange: '#FF9F0A',
          yellow: '#FFD60A',
          purple: '#BF5AF2',
          pink: '#FF375F',
          teal: '#64D2FF',
          fill: 'rgba(120, 120, 128, 0.36)',
          'fill-hover': 'rgba(120, 120, 128, 0.56)',
          separator: 'rgba(84, 84, 88, 0.65)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'Helvetica Neue', 'sans-serif'],
        mono: ['SF Mono', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      borderRadius: {
        'mac-sm': '6px',
        'mac': '10px',
        'mac-lg': '12px',
        'mac-xl': '16px',
      },
      height: {
        'mac-control': '28px',
        'mac-titlebar': '28px',
        'mac-sidebar': '220px',
        'mac-sidebar-collapsed': '60px',
      },
      spacing: {
        'mac': '20px',
        'mac-lg': '24px',
      },
      animation: {
        'fade-in': 'fadeIn 200ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'scale-in': 'scaleIn 200ms ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
};
