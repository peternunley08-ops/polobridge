/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        aquatic: {
          pool: '#0c4a6e',      // sky-900 sunlit base
          sapphire: '#1e3a8a',  // blue-900 deep water
          indigo: '#1e1b4b',    // indigo-950 optical chamber
          cyan: '#22d3ee',      // cyan-400 glass border & telemetry accent
          emerald: '#10b981',   // emerald-500 30s reset & start plunger
          amber: '#fbbf24',     // amber-400 20s rebound/exclusion & clock digits
          rose: '#f43f5e',      // rose-500 shot clock & horn plunger
        },
        brand: {
          cyan: '#00F0FF',
          purple: '#7000FF',
          surface: '#0c4a6e',
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        'plunger-emerald': '0 10px 0 #065f46, 0 18px 30px rgba(16, 185, 129, 0.4)',
        'plunger-teal': '0 10px 0 #115e59, 0 18px 30px rgba(20, 184, 166, 0.35)',
        'plunger-amber': '0 10px 0 #92400e, 0 18px 30px rgba(245, 158, 11, 0.4)',
        'plunger-rose': '0 10px 0 #881337, 0 18px 30px rgba(244, 63, 94, 0.45)',
        'aquatic-card': '0 24px 70px rgba(6, 182, 212, 0.25)',
      }
    },
  },
  plugins: [],
}
