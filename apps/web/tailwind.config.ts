import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sky Blues
        sky: {
          light: '#87CEEB',
          medium: '#5BA5E5',
          deep: '#4A90D9',
        },
        // Cloud Whites
        cloud: {
          white: '#FFFFFF',
          off: '#F8FBFF',
          soft: '#F0F4F8',
        },
        // Sunset Tones (CTAs and highlights)
        sunset: {
          orange: '#FFB347',
          pink: '#FF9AB3',
          coral: '#FF8C94',
        },
        // Success/Error
        success: {
          soft: '#A8E6CF',
        },
        error: {
          soft: '#FFB3B3',
        },
        // Neutrals
        neutral: {
          100: '#FAFBFC',
          200: '#E8ECEF',
          400: '#B0B8C0',
          600: '#6B7280',
          800: '#374151',
        },
      },
      fontFamily: {
        // Display font for headings - bold, geometric, futuristic
        display: ['var(--font-sora)', 'system-ui', 'sans-serif'],
        // Body font - clean with personality
        body: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
        // Monospace for numbers
        mono: [
          'SF Mono',
          'Monaco',
          'Cascadia Code',
          'Roboto Mono',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        '4xl': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        '3xl': ['2.5rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        '2xl': ['2rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        xl: ['1.5rem', { lineHeight: '1.3' }],
        lg: ['1.125rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.6' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        xs: ['0.75rem', { lineHeight: '1.4', letterSpacing: '0.05em' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 3s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      transitionTimingFunction: {
        'natural': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
      boxShadow: {
        'glass': '0 8px 32px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.6)',
        'glass-lg': '0 12px 28px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.05)',
        'sunset': '0 4px 12px rgba(255, 154, 179, 0.3)',
        'sunset-lg': '0 8px 24px rgba(255, 154, 179, 0.4)',
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
