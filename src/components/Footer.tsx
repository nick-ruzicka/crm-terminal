'use client'

import { useTheme } from './ThemeProvider'

export function Footer() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <footer
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 24px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: isDark
          ? 'linear-gradient(180deg, transparent 0%, rgba(18, 18, 20, 0.8) 100%)'
          : 'linear-gradient(180deg, transparent 0%, rgba(245, 243, 238, 0.9) 100%)',
        pointerEvents: 'none',
        zIndex: 50,
      }}
    >
      <p
        style={{
          fontSize: '11px',
          fontWeight: 400,
          letterSpacing: '0.02em',
          color: isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(91, 123, 140, 0.5)',
          pointerEvents: 'auto',
        }}
      >
        Design inspired by{' '}
        <a
          href="https://lucasblok.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: isDark ? 'rgba(212, 165, 217, 0.6)' : 'rgba(139, 91, 165, 0.7)',
            textDecoration: 'none',
            transition: 'color 0.2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = isDark
              ? 'rgba(212, 165, 217, 0.9)'
              : 'rgba(139, 91, 165, 1)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = isDark
              ? 'rgba(212, 165, 217, 0.6)'
              : 'rgba(139, 91, 165, 0.7)'
          }}
        >
          Lucas Blok
        </a>
      </p>
    </footer>
  )
}
