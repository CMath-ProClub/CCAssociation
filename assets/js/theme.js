window.tailwind = window.tailwind || {};
window.tailwind.config = {
  theme: {
    extend: {
      colors: {
        'cadott-ink': '#0f172a',
        'cadott-green': '#2e7d54',
        'cadott-blue': '#4f6d95',
        'cadott-amber': '#d28b26',
        'cadott-sand': '#f7f3ec',
        'cadott-clay': '#ede4d6'
      },
      fontFamily: {
        sans: ['"Open Sans"', '"Space Grotesk"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'serif']
      },
      boxShadow: {
        'card-soft': '0 12px 40px rgba(17, 24, 39, 0.08)'
      }
    }
  },
  safelist: [
    'bg-cadott-ink',
    'hover:bg-cadott-green',
    'bg-cadott-green',
    'text-white',
    'text-cadott-ink',
    'border',
    'border-slate-300',
    'hover:border-cadott-ink'
  ]
};
