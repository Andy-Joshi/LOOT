import React from 'react'

/**
 * StreakFlame Component
 *
 * Animated neon SVG flame that dynamically grows, changes color intensity,
 * and adds ember sparks based on the user's active streak count.
 *
 * @param {Object} props
 * @param {number} props.streak - Active streak days
 * @param {'sm'|'md'|'lg'} [props.size='sm'] - Flame display size
 */
export default function StreakFlame({ streak = 0, size = 'sm' }) {
  const pixelSize = size === 'lg' ? 44 : size === 'md' ? 28 : 20
  const isHighStreak = streak >= 5
  const isMidStreak = streak >= 2

  // Gradient colors depending on streak intensity
  const flameCoreColor = isHighStreak ? '#ffffff' : isMidStreak ? '#ffe875' : '#ffd159'
  const flameMidColor = isHighStreak ? '#67ff3a' : isMidStreak ? '#ff9138' : '#ff793f'
  const flameOuterColor = isHighStreak ? '#8a4dff' : isMidStreak ? '#ff3b30' : '#ff5252'

  return (
    <span
      className={`streak-flame-wrap streak-${size} ${isHighStreak ? 'supercharged' : ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        position: 'relative'
      }}
      title={`${streak} day money streak!`}
    >
      <svg
        width={pixelSize}
        height={pixelSize}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          filter: `drop-shadow(0 0 ${isHighStreak ? '10px #8a4dff' : isMidStreak ? '8px #ff9138' : '5px #ff5252'})`,
          overflow: 'visible'
        }}
      >
        <defs>
          <linearGradient id={`flame-grad-${streak}`} x1="16" y1="28" x2="16" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={flameOuterColor} />
            <stop offset="50%" stopColor={flameMidColor} />
            <stop offset="90%" stopColor={flameCoreColor} />
          </linearGradient>
          <radialGradient id={`flame-glow-${streak}`} cx="16" cy="20" r="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={flameCoreColor} stopOpacity="0.8" />
            <stop offset="60%" stopColor={flameMidColor} stopOpacity="0.4" />
            <stop offset="100%" stopColor={flameOuterColor} stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Outer Aura */}
        <circle cx="16" cy="20" r="10" fill={`url(#flame-glow-${streak})`} opacity="0.6">
          <animate attributeName="r" values="9;11;9" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0.75;0.4" dur="1.8s" repeatCount="indefinite" />
        </circle>

        {/* Base Flame Shape */}
        <path
          d="M16 3C16 3 10 11 10 18C10 23.52 12.69 28 16 28C19.31 28 22 23.52 22 18C22 11 16 3 16 3Z"
          fill={`url(#flame-grad-${streak})`}
        >
          <animate
            attributeName="d"
            dur="1.2s"
            repeatCount="indefinite"
            values="
              M16 3C16 3 10 11 10 18C10 23.52 12.69 28 16 28C19.31 28 22 23.52 22 18C22 11 16 3 16 3Z;
              M16 2C15 10 9 12 9 18C9 23.8 12.2 28.5 16 28.5C19.8 28.5 23 23.8 23 18C23 12 17 10 16 2Z;
              M16 3C16 3 10 11 10 18C10 23.52 12.69 28 16 28C19.31 28 22 23.52 22 18C22 11 16 3 16 3Z
            "
          />
        </path>

        {/* Inner Dancing Core */}
        <path
          d="M16 11C16 11 12.5 16 12.5 20C12.5 23 14 25.5 16 25.5C18 25.5 19.5 23 19.5 20C19.5 16 16 11 16 11Z"
          fill="#ffffff"
          opacity="0.9"
        >
          <animate
            attributeName="d"
            dur="0.8s"
            repeatCount="indefinite"
            values="
              M16 11C16 11 12.5 16 12.5 20C12.5 23 14 25.5 16 25.5C18 25.5 19.5 23 19.5 20C19.5 16 16 11 16 11Z;
              M16 9C15.5 15 12 16.5 12 20C12 23.2 13.8 25.8 16 25.8C18.2 25.8 20 23.2 20 20C20 16.5 16.5 15 16 9Z;
              M16 11C16 11 12.5 16 12.5 20C12.5 23 14 25.5 16 25.5C18 25.5 19.5 23 19.5 20C19.5 16 16 11 16 11Z
            "
          />
        </path>

        {/* Emitting Spark Particles for active streaks */}
        {streak > 0 && (
          <>
            <circle cx="16" cy="8" r="1.2" fill={flameCoreColor}>
              <animate attributeName="cy" values="14;2" dur="1s" repeatCount="indefinite" />
              <animate attributeName="cx" values="16;13" dur="1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0" dur="1s" repeatCount="indefinite" />
            </circle>
            <circle cx="17" cy="10" r="1" fill={flameMidColor}>
              <animate attributeName="cy" values="16;4" dur="1.4s" begin="0.4s" repeatCount="indefinite" />
              <animate attributeName="cx" values="17;20" dur="1.4s" begin="0.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0" dur="1.4s" begin="0.4s" repeatCount="indefinite" />
            </circle>
          </>
        )}
      </svg>
    </span>
  )
}
