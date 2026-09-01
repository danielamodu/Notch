/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        island: {
          bg: '#000000',
          card: '#0a0a0a',
          surface: '#121214',
          hover: '#1c1c1f',
          border: 'rgba(255, 255, 255, 0.08)',
          borderActive: 'rgba(255, 255, 255, 0.16)',
          accent: '#0A84FF',
          accentGreen: '#30D158',
          accentOrange: '#FF9F0A',
          accentRed: '#FF453A',
          muted: '#8e8e93',
          text: '#ffffff',
        }
      },
      fontFamily: {
        sans: [
          "'Space Grotesk'",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "sans-serif"
        ],
        mono: [
          "Consolas",
          "'SF Mono'",
          "Monaco",
          "monospace"
        ]
      },
      boxShadow: {
        'island-pill': '0 8px 32px -4px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.09)',
        'island-expanded': '0 20px 50px -10px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(255, 255, 255, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
      }
    },
  },
  plugins: [],
}
