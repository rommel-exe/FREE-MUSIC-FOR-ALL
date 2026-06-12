/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        groove: {
          black: '#141210',
          900: '#1c1917',
          800: '#231f1d',
          700: '#2c2725',
          600: '#362f2c',
          500: '#443c38',
          400: '#5c524c',
          300: '#8a7e72',
          200: '#b0a498',
          100: '#d8cec4',
          50: '#f5f0eb',
        },
        cream: {
          50: '#fefdfb',
          100: '#faf8f5',
          200: '#f5f0eb',
          300: '#ede8e2',
          400: '#e0d8cf',
          500: '#c8bfb4',
          600: '#9a8e82',
          700: '#6b6058',
          800: '#4a4038',
          900: '#2c2725',
        },
        emerald: {
          DEFAULT: '#10B981',
          hover: '#059669',
          active: '#047857',
          glow: 'rgba(16,185,129,0.15)',
          subtle: 'rgba(16,185,129,0.08)',
        },
        danger: {
          DEFAULT: '#ef4444',
          subtle: 'rgba(239,68,68,0.1)',
        },
        warning: '#f59e0b',
      },
      fontFamily: {
        sans: ['SF Pro', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        rounded: ['SF Pro Rounded', '-apple-system', 'sans-serif'],
        mono: ['SF Mono', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'mac-display': ['60px', { lineHeight: '1.1', fontWeight: '700' }],
        'mac-hero': ['30px', { lineHeight: '1.2', fontWeight: '700' }],
        'mac-title': ['20px', { lineHeight: '1.3', fontWeight: '700' }],
        'mac-headline': ['15px', { lineHeight: '1.4', fontWeight: '600' }],
        'mac-body': ['13px', { lineHeight: '1.4', fontWeight: '500' }],
        'mac-subhead': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        'mac-caption': ['10px', { lineHeight: '1.3', fontWeight: '500' }],
        'time': ['11px', { lineHeight: '1.3', fontWeight: '400', fontVariantNumeric: 'tabular-nums' }],
      },
      borderRadius: {
        'radius-sm': '6px',
        'radius-md': '8px',
        'radius-lg': '12px',
        'radius-xl': '16px',
      },
      height: {
        'sidebar-row': '40px',
        'sidebar-row-sm': '32px',
        'toolbar': '44px',
        'titlebar': '32px',
      },
      width: {
        'sidebar': '256px',
      },
      boxShadow: {
        'warm-sm': '0 1px 3px rgba(20,18,16,0.12), 0 1px 2px rgba(20,18,16,0.06)',
        'warm-md': '0 4px 12px rgba(20,18,16,0.15), 0 2px 4px rgba(20,18,16,0.08)',
        'warm-lg': '0 8px 24px rgba(20,18,16,0.18), 0 4px 8px rgba(20,18,16,0.10)',
        'warm-xl': '0 16px 48px rgba(20,18,16,0.22), 0 8px 16px rgba(20,18,16,0.12)',
        'emerald-glow': '0 0 0 3px rgba(16,185,129,0.25)',
        'glass-sidebar': `
          0 8px 40px rgba(20,18,16,0.12),
          0 0 8px rgba(20,18,16,0.20),
          inset -1px -1px 2px rgba(28,25,23,1),
          inset 1px 1px 2px rgba(28,25,23,1),
          inset 2px 2px 0.25px rgba(245,240,235,0.7),
          0 0 2px rgba(20,18,16,0.10)
        `,
        'glass-content': `
          0 8px 40px rgba(20,18,16,0.12),
          0 0 8px rgba(20,18,16,0.20),
          inset -1px -1px 2px rgba(28,25,23,1),
          inset 1px 1px 2px rgba(28,25,23,1),
          inset 2px 2px 0.25px rgba(245,240,235,0.5),
          0 0 2px rgba(20,18,16,0.10)
        `,
        'glass-floating': `
          0 8px 40px rgba(20,18,16,0.12),
          0 0 8px rgba(20,18,16,0.20),
          inset -1px -1px 2px rgba(28,25,23,1),
          inset 1px 1px 2px rgba(28,25,23,1),
          inset 2px 2px 0.25px rgba(245,240,235,0.7),
          0 0 2px rgba(20,18,16,0.10)
        `,
        'glass-popover': `
          0 16px 48px rgba(20,18,16,0.18),
          0 0 4px rgba(20,18,16,0.10),
          0 0 12px rgba(20,18,16,0.08),
          inset -1px -1px 2px rgba(28,25,23,1),
          inset 1px 1px 2px rgba(28,25,23,1),
          inset 2px 2px 0.25px rgba(245,240,235,0.7)
        `,
      },
      backdropBlur: {
        'glass': '40px',
        'glass-sm': '20px',
      },
      animation: {
        'fade-in': 'fadeIn 200ms cubic-bezier(0.4,0,0.2,1)',
        'slide-up': 'slideUp 200ms cubic-bezier(0.4,0,0.2,1)',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.4,0,0.2,1)',
        'fade-scale-in': 'fadeScaleIn 250ms cubic-bezier(0.4,0,0.2,1)',
        'slide-in-right': 'slideInRight 250ms cubic-bezier(0.4,0,0.2,1)',
        'slide-in-left': 'slideInLeft 250ms cubic-bezier(0.4,0,0.2,1)',
        'equalizer': 'equalizer 1.2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.96)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        fadeScaleIn: { '0%': { opacity: '0', transform: 'scale(0.97)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        slideInRight: { '0%': { opacity: '0', transform: 'translateX(12px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        slideInLeft: { '0%': { opacity: '0', transform: 'translateX(-12px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        equalizer: { '0%,100%': { height: '30%' }, '50%': { height: '100%' } },
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          '&::-webkit-scrollbar': { width: '6px', height: '6px' },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': { background: 'rgba(92,82,76,0.4)', borderRadius: '3px', border: '1px solid transparent', backgroundClip: 'content-box' },
          '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(92,82,76,0.6)', backgroundClip: 'content-box' },
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        },
        '.overscroll-contain': { 'overscroll-behavior': 'contain' },
      });
    },
  ],
};
