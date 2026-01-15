'use client'

import { useTheme } from './ThemeProvider'

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <div className={`toggle-icon ${isDark ? 'is-dark' : 'is-light'}`}>
        {/* Sun/Moon body */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="celestial-body"
        >
          {/* Main circle - morphs between sun and moon */}
          <circle
            cx="12"
            cy="12"
            r="5"
            className="body-circle"
          />

          {/* Moon crater details (visible in dark mode) */}
          <g className="moon-details">
            <circle cx="10" cy="10" r="1" />
            <circle cx="13.5" cy="13" r="0.7" />
            <circle cx="10.5" cy="14" r="0.5" />
          </g>

          {/* Eclipse mask - slides in/out */}
          <circle
            cx="12"
            cy="12"
            r="5"
            className="eclipse-mask"
          />
        </svg>

        {/* Sun rays (visible in light mode) */}
        <div className="rays">
          {[...Array(8)].map((_, i) => (
            <span
              key={i}
              className="ray"
              style={{
                transform: `rotate(${i * 45}deg)`,
                animationDelay: `${i * 0.05}s`
              }}
            />
          ))}
        </div>

        {/* Stars (visible in dark mode) */}
        <div className="stars">
          <span className="star star-1" />
          <span className="star star-2" />
          <span className="star star-3" />
        </div>
      </div>

      <style jsx>{`
        .theme-toggle {
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid var(--border-color);
          background: var(--bg-secondary);
          transition: all 0.3s ease;
          overflow: hidden;
        }

        .theme-toggle:hover {
          transform: scale(1.05);
          box-shadow: 0 0 20px var(--glow-color);
        }

        .theme-toggle:active {
          transform: scale(0.95);
        }

        .toggle-icon {
          position: relative;
          width: 24px;
          height: 24px;
          transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .toggle-icon.is-dark {
          transform: rotate(0deg);
        }

        .toggle-icon.is-light {
          transform: rotate(360deg);
        }

        .celestial-body {
          width: 100%;
          height: 100%;
          position: relative;
          z-index: 2;
        }

        .body-circle {
          fill: var(--celestial-color);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .is-light .body-circle {
          fill: #fbbf24;
        }

        .is-dark .body-circle {
          fill: #e2e8f0;
        }

        /* Eclipse mask animation */
        .eclipse-mask {
          fill: var(--bg-secondary);
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .is-light .eclipse-mask {
          transform: translateX(10px);
          opacity: 0;
        }

        .is-dark .eclipse-mask {
          transform: translateX(3px) translateY(-2px);
          opacity: 1;
        }

        /* Moon details */
        .moon-details {
          fill: rgba(0, 0, 0, 0.1);
          transition: opacity 0.3s ease;
        }

        .is-light .moon-details {
          opacity: 0;
        }

        .is-dark .moon-details {
          opacity: 1;
        }

        /* Sun rays */
        .rays {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ray {
          position: absolute;
          width: 2px;
          height: 6px;
          background: #fbbf24;
          border-radius: 1px;
          transform-origin: center 12px;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .is-light .ray {
          opacity: 1;
          height: 6px;
        }

        .is-dark .ray {
          opacity: 0;
          height: 0;
        }

        /* Animated rays pulse in light mode */
        .is-light .ray {
          animation: rayPulse 2s ease-in-out infinite;
        }

        @keyframes rayPulse {
          0%, 100% { height: 5px; opacity: 0.8; }
          50% { height: 7px; opacity: 1; }
        }

        /* Stars */
        .stars {
          position: absolute;
          inset: -4px;
          pointer-events: none;
        }

        .star {
          position: absolute;
          width: 3px;
          height: 3px;
          background: #e2e8f0;
          border-radius: 50%;
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .star-1 { top: 2px; left: 4px; }
        .star-2 { top: 6px; right: 0; width: 2px; height: 2px; }
        .star-3 { bottom: 4px; left: 0; width: 2px; height: 2px; }

        .is-light .star {
          opacity: 0;
          transform: scale(0);
        }

        .is-dark .star {
          opacity: 1;
          transform: scale(1);
          animation: twinkle 1.5s ease-in-out infinite;
        }

        .star-1 { animation-delay: 0s; }
        .star-2 { animation-delay: 0.5s; }
        .star-3 { animation-delay: 1s; }

        @keyframes twinkle {
          0%, 100% { opacity: 0.4; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
      `}</style>
    </button>
  )
}
