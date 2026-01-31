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
        'daybreak-bg': '#0a0a0f',
        'daybreak-card': '#1a1a2e',
        'daybreak-accent': '#00d9ff',
        'daybreak-dim': '#666680',
      },
    },
  },
  plugins: [],
}
export default config
