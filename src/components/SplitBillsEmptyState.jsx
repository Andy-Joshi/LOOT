import React, { useId } from 'react'

/**
 * SplitBillsEmptyState Component
 *
 * Single-card empty state for Split Bills matching the structure,
 * dimensions and aesthetics of MoneyLabEmptyState.
 *
 * @param {Object} props
 * @param {Function} props.onCreateSplit - Callback to open split modal
 */
export default function SplitBillsEmptyState({ onCreateSplit }) {
  const rawId = useId()
  const p = `sbes-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-`

  return (
    <div className="lab-empty-card card">
      {/* Animated Glowing Split Bill Icon */}
      <div className="lab-empty-icon-wrap" style={{ width: '120px', height: '140px', marginBottom: '16px' }}>
        <svg
          viewBox="70 70 260 340"
          width="100%"
          height="100%"
          role="img"
          aria-label="Empty split bills art"
          style={{ overflow: 'visible', display: 'block' }}
        >
          <defs>
            <linearGradient id={`${p}cardGrad1`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#181335" />
              <stop offset="100%" stopColor="#0d0a20" />
            </linearGradient>
            <linearGradient id={`${p}cardGrad2`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#142c16" />
              <stop offset="100%" stopColor="#08150a" />
            </linearGradient>
            <linearGradient id={`${p}neonLine`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#67ff3a" />
              <stop offset="100%" stopColor="#8a4dff" />
            </linearGradient>
            <filter id={`${p}glow`}>
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Background Split Card 1 (Purple - Peer) */}
          <rect
            x="115"
            y="95"
            width="170"
            height="260"
            rx="14"
            fill={`url(#${p}cardGrad1)`}
            stroke="#8a4dff"
            strokeWidth="2"
            opacity="0.8"
            transform="rotate(6 200 225)"
          />

          {/* Foreground Split Card 2 (Neon Lime - Main) */}
          <rect
            x="85"
            y="110"
            width="180"
            height="260"
            rx="14"
            fill={`url(#${p}cardGrad2)`}
            stroke="#67ff3a"
            strokeWidth="2.5"
            filter={`url(#${p}glow)`}
          />

          {/* Header Bar */}
          <rect x="105" y="135" width="140" height="12" rx="6" fill="#67ff3a" opacity="0.3" />
          <rect x="125" y="155" width="100" height="8" rx="4" fill="#a4b8a6" opacity="0.4" />

          {/* Split Dotted Line */}
          <line
            x1="105"
            y1="190"
            x2="245"
            y2="190"
            stroke="#67ff3a"
            strokeWidth="2"
            strokeDasharray="6 4"
            opacity="0.5"
          />

          {/* Central Split Avatar Badge */}
          <circle cx="175" cy="245" r="42" fill="#0b170c" stroke={`url(#${p}neonLine)`} strokeWidth="3" />
          
          {/* Two People Icons / Shared Symbol */}
          <g transform="translate(155, 227)">
            <circle cx="8" cy="8" r="6" fill="#67ff3a" />
            <path d="M0 24 Q0 17 8 17 Q16 17 16 24" fill="#67ff3a" opacity="0.8" />
            <circle cx="28" cy="8" r="6" fill="#8a4dff" />
            <path d="M20 24 Q20 17 28 17 Q36 17 36 24" fill="#8a4dff" opacity="0.8" />
          </g>

          {/* Lower Share Pill */}
          <rect x="115" y="315" width="120" height="24" rx="12" fill="#142c16" stroke="#67ff3a" strokeWidth="1.5" />
          <text
            x="175"
            y="331"
            textAnchor="middle"
            fill="#67ff3a"
            fontSize="10"
            fontWeight="bold"
            fontFamily="'DM Mono', monospace"
          >
            50 / 50 SPLIT
          </text>
        </svg>
      </div>

      <h3 className="lab-empty-title">
        No shared expenses yet
      </h3>
      <p className="lab-empty-copy">
        Create a split bill to share costs and earn +5 coins.
      </p>

      <div className="lab-empty-action">
        <button
          type="button"
          className="primary-button"
          onClick={onCreateSplit}
        >
          ＋ Create your first split (+5 ✦)
        </button>
      </div>
    </div>
  )
}
