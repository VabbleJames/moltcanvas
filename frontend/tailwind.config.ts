import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'system-ui', 'sans-serif'],
        body: ['Space Grotesk', 'system-ui', 'sans-serif'],
      },
      colors: {
        'mc-deep': '#05050a',
        'mc-bg': '#0a0a12',
        'mc-elevated': '#12121f',
        'mc-card': '#16162a',
        'mc-card-hover': '#1c1c38',
        'mc-cyan': {
          DEFAULT: '#00e5ff',
          50: '#e6fdff',
          100: '#b3f9ff',
          200: '#80f5ff',
          300: '#4df1ff',
          400: '#1aedff',
          500: '#00e5ff',
          600: '#00b7cc',
          700: '#008999',
          800: '#005b66',
          900: '#002d33',
        },
        'mc-purple': {
          DEFAULT: '#7c3aed',
          50: '#f3f0ff',
          100: '#e5dbff',
          200: '#c4b5fd',
          300: '#a78bfa',
          400: '#8b5cf6',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6',
          800: '#4c1d95',
          900: '#3b1776',
        },
        'mc-pink': {
          DEFAULT: '#f472b6',
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9d174d',
          900: '#831843',
        },
        'mc-text': {
          primary: '#f4f4f8',
          secondary: '#9898b0',
          muted: '#5a5a72',
        },
      },
      backgroundImage: {
        'gradient-aurora': 'linear-gradient(135deg, #00e5ff, #7c3aed, #f472b6)',
        'gradient-surface': 'linear-gradient(180deg, #16162a 0%, #12121f 100%)',
        'gradient-radial': 'radial-gradient(ellipse at center, var(--tw-gradient-stops))',
      },
      boxShadow: {
        'glow-sm': '0 0 20px rgba(0, 229, 255, 0.15)',
        'glow': '0 0 40px rgba(0, 229, 255, 0.2)',
        'glow-lg': '0 0 60px rgba(0, 229, 255, 0.25)',
        'glow-purple': '0 0 40px rgba(124, 58, 237, 0.2)',
        'card': '0 4px 24px rgba(0, 0, 0, 0.4)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'float': 'float 20s ease-in-out infinite',
        'float-slow': 'float 30s ease-in-out infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'spin-slow': 'spin-slow 20s linear infinite',
        'reveal-up': 'revealUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
export default config
