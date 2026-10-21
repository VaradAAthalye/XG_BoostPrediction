/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: '#06080C',
          900: '#0B0F17',
          850: '#101623',
          800: '#161E2E',
          750: '#1D273B',
          700: '#25324B',
          600: '#384869',
          500: '#52658A',
        },
        neon: {
          400: '#39FF14',
          500: '#00FF66', // Formula E electric lime
          600: '#00D655',
          700: '#00A843',
          glow: 'rgba(0, 255, 102, 0.4)',
        },
        racing: {
          cyan: '#00F0FF',
          amber: '#F59E0B',
          red: '#EF4444',
          purple: '#A855F7',
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'sans-serif'],
      },
      boxShadow: {
        'neon': '0 0 20px -2px rgba(0, 255, 102, 0.35)',
        'neon-lg': '0 0 35px -5px rgba(0, 255, 102, 0.5)',
        'cyan-glow': '0 0 20px -2px rgba(0, 240, 255, 0.35)',
        'card': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      backgroundImage: {
        'carbon-pattern': 'radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0)',
        'racing-gradient': 'linear-gradient(135deg, rgba(16, 22, 35, 0.9) 0%, rgba(11, 15, 23, 0.95) 100%)',
      }
    },
  },
  plugins: [],
}


