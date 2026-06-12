/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // macOS 26 dark backgrounds
        dark: {
          primary: '#070707',
          secondary: '#080808',
          tertiary: '#0D0D0D',
          quaternary: '#141414',
          quinary: '#232323',
        },
        // macOS 26 light backgrounds
        light: {
          primary: '#FFFFFF',
          secondary: '#F9F9F9',
          tertiary: '#F0F0F0',
          quaternary: '#E8E8E8',
          quinary: '#DCDCDC',
        },
        // macOS 26 semantic labels
        label: {
          dark: {
            primary: '#F4F4F4',
            secondary: '#898989',
            tertiary: '#404040',
            quaternary: '#252525',
          },
          light: {
            primary: '#1C1C1E',
            secondary: '#636366',
            tertiary: '#AEAEB2',
            quaternary: '#C7C7CC',
          },
        },
        // Accent blue — dark/light variants
        accent: {
          DEFAULT: '#0087FF',
          hover: '#0070E0',
          active: '#005BBB',
          light: '#007AFF',
          'light-hover': '#0066D6',
          'light-active': '#0052AD',
        },
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
        // Dark mode liquid glass stacks (6-layer)
        'glass-sidebar-dark': `
          0 8px 40px rgba(0,0,0,0.12),
          0 0 8px rgba(0,0,0,0.20),
          inset -1px -1px 2px rgba(25,25,25,1),
          inset 1px 1px 2px rgba(25,25,25,1),
          inset 2px 2px 0.25px rgba(255,255,255,0.7),
          0 0 2px rgba(0,0,0,0.10)
        `,
        'glass-content-dark': `
          0 8px 40px rgba(0,0,0,0.12),
          0 0 8px rgba(0,0,0,0.20),
          inset -1px -1px 2px rgba(25,25,25,1),
          inset 1px 1px 2px rgba(25,25,25,1),
          inset 2px 2px 0.25px rgba(255,255,255,0.5),
          0 0 2px rgba(0,0,0,0.10)
        `,
        'glass-floating-dark': `
          0 8px 40px rgba(0,0,0,0.12),
          0 0 8px rgba(0,0,0,0.20),
          inset -1px -1px 2px rgba(25,25,25,1),
          inset 1px 1px 2px rgba(25,25,25,1),
          inset 2px 2px 0.25px rgba(255,255,255,0.7),
          0 0 2px rgba(0,0,0,0.10)
        `,
        'glass-popover-dark': `
          0 16px 48px rgba(0,0,0,0.18),
          0 0 4px rgba(0,0,0,0.10),
          0 0 12px rgba(0,0,0,0.08),
          inset -1px -1px 2px rgba(25,25,25,1),
          inset 1px 1px 2px rgba(25,25,25,1),
          inset 2px 2px 0.25px rgba(255,255,255,0.7)
        `,
        // Light mode liquid glass stacks
        'glass-sidebar-light': `
          0 2px 16px rgba(0,0,0,0.04),
          0 0 4px rgba(0,0,0,0.03),
          0 0 0.5px rgba(0,0,0,0.06),
          inset 0 0.5px 0 rgba(255,255,255,0.6),
          inset 0 -0.5px 0 rgba(0,0,0,0.02),
          0 0 1px rgba(0,0,0,0.04)
        `,
        'glass-content-light': `
          0 2px 16px rgba(0,0,0,0.04),
          0 0 4px rgba(0,0,0,0.03),
          inset 0 0.5px 0 rgba(255,255,255,0.6),
          inset 0 -0.5px 0 rgba(0,0,0,0.02),
          0 0 1px rgba(0,0,0,0.04)
        `,
        'glass-floating-light': `
          0 4px 24px rgba(0,0,0,0.06),
          0 0 8px rgba(0,0,0,0.03),
          inset 0 0.5px 0 rgba(255,255,255,0.8),
          inset 0 -0.5px 0 rgba(0,0,0,0.02),
          0 0 1px rgba(0,0,0,0.04)
        `,
        'glass-popover-light': `
          0 16px 48px rgba(0,0,0,0.08),
          0 0 4px rgba(0,0,0,0.04),
          inset 0 0.5px 0 rgba(255,255,255,0.8),
          inset 0 -0.5px 0 rgba(0,0,0,0.02),
          0 0 1px rgba(0,0,0,0.04)
        `,
        'focus-ring': '0 0 0 3px rgba(0,135,255,0.3)',
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
          '&::-webkit-scrollbar-thumb': { background: 'rgba(120,120,128,0.28)', borderRadius: '3px', border: '1px solid transparent', backgroundClip: 'content-box' },
          '&::-webkit-scrollbar-thumb:hover': { background: 'rgba(120,120,128,0.48)', backgroundClip: 'content-box' },
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
