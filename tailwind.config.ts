import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#121214',
          secondary: '#1a1a1e',
          tertiary: '#222226',
          hover: '#2a2a2e',
          elevated: '#252529',
        },
        border: {
          DEFAULT: '#2e2e32',
          subtle: '#252528',
          strong: '#3a3a3e',
        },
        text: {
          primary: '#fafafa',
          secondary: '#a1a1a6',
          muted: '#6e6e73',
        },
        accent: {
          DEFAULT: '#3b82f6',
          hover: '#2563eb',
          glow: 'rgba(59, 130, 246, 0.15)',
        },
        success: {
          DEFAULT: '#22c55e',
          glow: 'rgba(34, 197, 94, 0.15)',
        },
        warning: {
          DEFAULT: '#f59e0b',
          glow: 'rgba(245, 158, 11, 0.15)',
        },
        danger: {
          DEFAULT: '#ef4444',
          glow: 'rgba(239, 68, 68, 0.15)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'SF Pro Display', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'glow-sm': '0 0 20px -5px rgba(59, 130, 246, 0.3)',
        'glow-md': '0 0 30px -5px rgba(59, 130, 246, 0.4)',
        'glow-success': '0 0 20px -5px rgba(34, 197, 94, 0.3)',
        'glow-warning': '0 0 20px -5px rgba(245, 158, 11, 0.3)',
        'glow-danger': '0 0 20px -5px rgba(239, 68, 68, 0.3)',
        'elevated': '0 8px 32px rgba(0, 0, 0, 0.4)',
        'card': '0 1px 3px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.15)',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'shimmer': 'shimmer 2s infinite linear',
        'pulse-slow': 'pulse 3s infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-out-right': 'slideOutRight 0.3s ease-in',
        'fade-in': 'fadeIn 0.2s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}

export default config
