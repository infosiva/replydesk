import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#faf7f4',
        surface: '#ffffff',
        'surface-muted': '#f3ede6',
        primary: '#1a1209',
        accent: '#c8894a',
        'accent-light': '#e8b87a',
        'accent-dark': '#9a6030',
        secondary: '#7c6e5c',
        muted: '#b0a090',
        border: '#e4d9cc',
        'text-secondary': '#5a4e40',
        'text-muted': '#9a8878',
      },
      fontFamily: {
        display: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        card: '0 2px 16px rgba(26,18,9,0.08)',
        'card-hover': '0 8px 32px rgba(26,18,9,0.14)',
        btn: '0 2px 8px rgba(200,137,74,0.25)',
        'btn-hover': '0 4px 16px rgba(200,137,74,0.35)',
      },
    },
  },
  plugins: [],
}

export default config
