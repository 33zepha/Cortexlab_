import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Single source of truth: ui/tokens.json (see ui/DESIGN.md). Do not hardcode
// colors/radii/spacing elsewhere — extend this file if tokens.json grows.
const tokensPath = fileURLToPath(new URL('../ui/tokens.json', import.meta.url))
const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'))

const color = (name) => tokens.color[name].value
const dim = (name) => tokens.dimension[name].value

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: color('primary'),
        'primary-hover': color('primary-hover'),
        success: color('success'),
        'success-bg': '#DCFCE7',
        warning: color('warning'),
        'warning-bg': '#FEF3C7',
        error: color('error'),
        'error-bg': '#FEE2E2',
        info: color('info'),
        running: color('running'),
        'running-bg': '#E0F2FE',
        bg: color('bg'),
        surface: color('surface'),
        border: color('border'),
        text: color('text'),
        'text-muted': color('text-muted'),
      },
      borderRadius: {
        sm: dim('radius-sm'),
        md: dim('radius-md'),
        lg: dim('radius-lg'),
        xl: dim('radius-xl'),
      },
      spacing: {
        xs: dim('space-xs'),
        sm: dim('space-sm'),
        md: dim('space-md'),
        lg: dim('space-lg'),
        xl: dim('space-xl'),
      },
      fontFamily: {
        sans: [tokens.typography['font-sans'].value],
        mono: [tokens.typography['font-mono'].value],
      },
      boxShadow: {
        card: '0 1px 3px rgba(17, 24, 39, 0.08)',
        overlay: '0 4px 12px rgba(17, 24, 39, 0.10)',
      },
    },
  },
  plugins: [],
}
