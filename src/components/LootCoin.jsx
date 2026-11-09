import React from 'react'

/**
 * Reusable stylized LOOT Coin icon
 * High-tech pixel aesthetic with neon gradients and crisp edges.
 */
export function LootCoin({ size = 'md', className = '', glow = false }) {
  const sizeMap = {
    xs: { dim: 14, font: 9, stroke: 1 },
    sm: { dim: 18, font: 11, stroke: 1.5 },
    md: { dim: 24, font: 13, stroke: 2 },
    lg: { dim: 36, font: 20, stroke: 2.5 },
    xl: { dim: 56, font: 32, stroke: 3 }
  }

  const { dim, stroke } = sizeMap[size] || sizeMap.md

  return (
    <span
      className={`loot-coin-wrapper ${size} ${glow ? 'glowing' : ''} ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        width: `${dim}px`,
        height: `${dim}px`,
        flexShrink: 0
      }}
      title="LOOT Coin"
    >
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <defs>
          <linearGradient id="coinGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e8ff75" />
            <stop offset="0.5" stopColor="#c8ff3d" />
            <stop offset="1" stopColor="#8cc726" />
          </linearGradient>
          <linearGradient id="coinInner" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1b2e1a" />
            <stop offset="1" stopColor="#0f1910" />
          </linearGradient>
          <filter id="pixelGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="0" stdDeviation="2" floodColor="#c8ff3d" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Outer Coin Body (octagonal pixel-feel coin) */}
        <path
          d="M10 2 H22 L30 10 V22 L22 30 H10 L2 22 V10 Z"
          fill="url(#coinGrad)"
          stroke="#071008"
          strokeWidth={stroke}
          filter={glow ? 'url(#pixelGlow)' : undefined}
        />

        {/* Inner Coin Chamber */}
        <path
          d="M11 5 H21 L27 11 V21 L21 27 H11 L5 21 V11 Z"
          fill="url(#coinInner)"
          stroke="#425f38"
          strokeWidth="1"
        />

        {/* Center Spark / Diamond Glyph */}
        <path
          d="M16 8 L18.5 13.5 L24 16 L18.5 18.5 L16 24 L13.5 18.5 L8 16 L13.5 13.5 Z"
          fill="url(#coinGrad)"
        />

        {/* Highlight pixel */}
        <rect x="11" y="8" width="2" height="2" fill="#ffffff" opacity="0.8" />
      </svg>
    </span>
  )
}

export default LootCoin
