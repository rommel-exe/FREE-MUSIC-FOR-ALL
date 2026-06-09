/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // macOS System Colors
        mac: {
          // Accents
          blue: '#0A84FF',
          green: '#30D158',
          red: '#FF453A',
          orange: '#FF9F0A',
          yellow: '#FFD60A',
          purple: '#BF5AF2',
          pink: '#FF375F',
          teal: '#64D2FF',
          indigo: '#5E5CE6',
          // Backgrounds
          bg: {
            primary: '#1C1C1E',
            secondary: '#2C2C2E',
            tertiary: '#3A3A3C',
            quaternary: '#48484A',
            elevated: '#2C2C2E',
            grouped: {
              primary: '#1C1C1E',
              secondary: '#2C2C2E',
              tertiary: '#3A3A3C',
            },
          },
          // Labels
          label: {
            primary: '#FFFFFF',
            secondary: 'rgba(235, 235, 245, 0.85)',
            tertiary: 'rgba(235, 235, 245, 0.60)',
            quaternary: 'rgba(235, 235, 245, 0.30)',
          },
          // Fills
          fill: {
            primary: 'rgba(120, 120, 128, 0.36)',
            secondary: 'rgba(120, 120, 128, 0.24)',
            tertiary: 'rgba(118, 118, 128, 0.16)',
            quaternary: 'rgba(118, 118, 128, 0.08)',
          },
          // Materials
          separator: 'rgba(84, 84, 88, 0.65)',
          separatorOpaque: '#38383A',
          overlay: 'rgba(0, 0, 0, 0.32)',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        display: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"Helvetica Neue"', 'sans-serif'],
        mono: ['"SF Mono"', 'SFMono-Regular', 'Menlo', 'Monaco', '"Courier New"', 'monospace'],
      },
      fontSize: {
        // macOS text styles (mapped to Tailwind)
        'mac-large-title': ['28px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '700' }],
        'mac-title-1': ['22px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '700' }],
        'mac-title-2': ['17px', { lineHeight: '1.3', fontWeight: '600' }],
        'mac-title-3': ['15px', { lineHeight: '1.4', fontWeight: '600' }],
        'mac-headline': ['17px', { lineHeight: '1.3', fontWeight: '600' }],
        'mac-body': ['15px', { lineHeight: '1.5', fontWeight: '400' }],
        'mac-callout': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'mac-subheadline': ['13px', { lineHeight: '1.4', fontWeight: '400' }],
        'mac-footnote': ['12px', { lineHeight: '1.4', fontWeight: '400' }],
        'mac-caption': ['11px', { lineHeight: '1.4', fontWeight: '400' }],
        'mac-caption-2': ['10px', { lineHeight: '1.4', fontWeight: '500' }],
      },
      borderRadius: {
        'mac-sm': '6px',
        'mac': '10px',
        'mac-lg': '12px',
        'mac-xl': '16px',
        'mac-2xl': '20px',
      },
      spacing: {
        'mac': '16px',
        'mac-lg': '20px',
        'mac-xl': '24px',
        'mac-2xl': '32px',
      },
      height: {
        'mac-control': '28px',
        'mac-control-sm': '22px',
        'mac-control-lg': '36px',
        'mac-titlebar': '44px',
        'mac-sidebar': '240px',
        'mac-sidebar-collapsed': '60px',
        'mac-player': '88px',
      },
      width: {
        'mac-sidebar': '240px',
      },
      maxWidth: {
        'mac-content': '1200px',
      },
      animation: {
        'fade-in': 'fadeIn 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-up': 'slideUp 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'scale-in': 'scaleIn 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-right': 'slideRight 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'slide-left': 'slideLeft 200ms cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce-subtle': 'bounceSubtle 2s infinite',
        'shimmer': 'shimmer 2s infinite linear',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'breathe': 'breathe 4s ease-in-out infinite',
        'equalizer': 'equalizer 1.2s ease-in-out infinite',
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
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-2px)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.03)' },
        },
        equalizer: {
          '0%, 100%': { height: '30%' },
          '50%': { height: '100%' },
        },
      },
      boxShadow: {
        'mac': '0 0 0 0.5px rgba(0, 0, 0, 0.1), 0 4px 12px rgba(0, 0, 0, 0.15)',
        'mac-lg': '0 0 0 0.5px rgba(0, 0, 0, 0.1), 0 8px 24px rgba(0, 0, 0, 0.2)',
        'mac-xl': '0 0 0 0.5px rgba(0, 0, 0, 0.1), 0 16px 40px rgba(0, 0, 0, 0.3)',
        'mac-2xl': '0 0 0 0.5px rgba(0, 0, 0, 0.1), 0 24px 64px rgba(0, 0, 0, 0.4)',
        'mac-inner': 'inset 0 0 0 0.5px rgba(255, 255, 255, 0.1)',
        'mac-focus': '0 0 0 3px rgba(10, 132, 255, 0.4)',
        'mac-glow': '0 0 20px rgba(10, 132, 255, 0.15), 0 0 0 0.5px rgba(10, 132, 255, 0.3)',
        'mac-glow-green': '0 0 20px rgba(48, 209, 88, 0.15), 0 0 0 0.5px rgba(48, 209, 88, 0.3)',
      },
      transitionTimingFunction: {
        'mac': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'mac-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      transitionDuration: {
        'mac': '150ms',
        'mac-slow': '250ms',
      },
      backdropBlur: {
        'mac': '40px',
        'mac-content': '20px',
        'mac-control': '10px',
        'mac-heavy': '60px',
      },
    },
  },
  plugins: [
    function({ addUtilities }) {
      addUtilities({
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none',
          },
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          '&::-webkit-scrollbar': {
            width: '4px',
            height: '4px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(120, 120, 128, 0.24)',
            borderRadius: '2px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            background: 'rgba(120, 120, 128, 0.4)',
          },
        },
        '.text-balance': {
          'text-wrap': 'balance',
        },
      });
    },
  ],
};
