import type { Config } from 'tailwindcss';

export default {
  content: ['./embed.html', './index.html', './src/widget/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      colors: {
        famaash: {
          DEFAULT: 'var(--famaash-brand)',
          light: 'var(--famaash-brand-light)',
          soft: 'var(--famaash-brand-soft)',
          border: 'var(--famaash-brand-border)',
          stroke: 'var(--famaash-brand-stroke)',
          'on-brand': 'var(--famaash-on-brand)',
        },
        obsidian: 'var(--obsidian)',
        ink: {
          DEFAULT: 'var(--ink)',
          soft: 'var(--ink-soft)',
        },
        muted: {
          DEFAULT: 'var(--muted)',
          soft: 'var(--muted-soft)',
          lighter: 'var(--muted-lighter)',
        },
        canvas: 'var(--bg-canvas)',
        subtle: 'var(--bg-subtle)',
        hairline: {
          DEFAULT: 'var(--hairline)',
          soft: 'var(--hairline-soft)',
        },
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
        },
        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
        },
      },
      borderRadius: {
        sm: 'var(--r-sm)',
        md: 'var(--r-md)',
        lg: 'var(--r-lg)',
        xl: 'var(--r-xl)',
        pill: 'var(--r-pill)',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
