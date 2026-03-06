/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        m3: {
          bg:               '#0F1114',
          surface:          '#1A1C22',
          surfaceContainer: '#1E2127',
          surfaceHigh:      '#252830',
          border:           '#2E3138',
          borderSubtle:     '#23262D',
          text:             '#E3E3E8',
          textSecondary:    '#9DA0A9',
          muted:            '#6C7080',
          primary:          '#A8C7FA',
          primaryContainer: '#0842A0',
          onPrimary:        '#062E6F',
          error:            '#FFB4AB',
          errorContainer:   '#93000A',
          success:          '#81C995',
          successContainer: '#005225',
          accent:           '#7FCFFF',
          black:            '#000000',
          overlay:          'rgba(0,0,0,0.6)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        m3:    '12px',
        'm3-sm': '8px',
        'm3-lg': '16px',
        'm3-xl': '24px',
      },
      boxShadow: {
        m3:      '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.24)',
        'm3-md': '0 3px 6px rgba(0,0,0,0.3), 0 3px 6px rgba(0,0,0,0.22)',
        'm3-lg': '0 10px 20px rgba(0,0,0,0.3), 0 6px 6px rgba(0,0,0,0.22)',
      },
    },
  },
  plugins: [],
};
