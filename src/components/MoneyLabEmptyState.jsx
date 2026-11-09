import React, { useId } from 'react'
import { isDebugMode } from '../utils/debug'

/**
 * MoneyLabEmptyState Component
 *
 * Single-card empty state with generous padding and centered animated receipt art.
 * Displays title, concise copy, and ONE primary action button.
 *
 * @param {Object} props
 * @param {Function} props.onAddSpend - Callback to open expense modal
 * @param {Function} [props.onPreviewArt] - Callback to play full celebration (developer only)
 */
export default function MoneyLabEmptyState({ onAddSpend, onPreviewArt }) {
  const rawId = useId()
  const p = `mles-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-`
  const showDevArt = isDebugMode() && Boolean(onPreviewArt)

  return (
    <div className="lab-empty-card card">
      {/* Animated Glowing Receipt Icon */}
      <div className="lab-empty-icon-wrap" style={{ width: '120px', height: '140px', marginBottom: '16px' }}>
        <svg
          viewBox="70 70 260 340"
          width="100%"
          height="100%"
          role="img"
          aria-label="Empty ledger receipt art"
          style={{ overflow: 'visible', display: 'block' }}
        >
          <defs>
            <linearGradient id={`${p}rg`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#142c16" />
              <stop offset="100%" stopColor="#08150a" />
            </linearGradient>
            <linearGradient id={`${p}checkGrad`} x1="0" y1="0" x2="1" y2="1">
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

          {/* Receipt Background Card */}
          <rect
            x="95"
            y="90"
            width="210"
            height="290"
            rx="16"
            fill={`url(#${p}rg)`}
            stroke="#67ff3a"
            strokeWidth="2.5"
            strokeDasharray="6 4"
            filter={`url(#${p}glow)`}
          />

          {/* Receipt Header Bar */}
          <rect x="120" y="115" width="160" height="12" rx="6" fill="#67ff3a" opacity="0.3" />
          <rect x="145" y="135" width="110" height="8" rx="4" fill="#a4b8a6" opacity="0.4" />

          {/* Receipt Checkmark Badge */}
          <circle cx="200" cy="225" r="48" fill="#0b170c" stroke={`url(#${p}checkGrad)`} strokeWidth="3" />
          <path
            d="M182 225 L195 238 L222 210"
            fill="none"
            stroke="#67ff3a"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Barcode Lines at Bottom */}
          <g opacity="0.5" transform="translate(125, 310)">
            <rect x="0" y="0" width="4" height="24" fill="#67ff3a" />
            <rect x="8" y="0" width="8" height="24" fill="#67ff3a" />
            <rect x="20" y="0" width="3" height="24" fill="#67ff3a" />
            <rect x="28" y="0" width="10" height="24" fill="#67ff3a" />
            <rect x="44" y="0" width="5" height="24" fill="#67ff3a" />
            <rect x="54" y="0" width="7" height="24" fill="#67ff3a" />
            <rect x="66" y="0" width="4" height="24" fill="#67ff3a" />
            <rect x="76" y="0" width="9" height="24" fill="#67ff3a" />
            <rect x="92" y="0" width="6" height="24" fill="#67ff3a" />
            <rect x="104" y="0" width="8" height="24" fill="#67ff3a" />
            <rect x="118" y="0" width="4" height="24" fill="#67ff3a" />
            <rect x="128" y="0" width="10" height="24" fill="#67ff3a" />
            <rect x="144" y="0" width="5" height="24" fill="#67ff3a" />
          </g>
        </svg>
      </div>

      <h3 className="lab-empty-title">
        No transactions lodged yet
      </h3>
      <p className="lab-empty-copy">
        Log your first spend to earn +2 coins.
      </p>

      <div className="lab-empty-action">
        <button
          type="button"
          className="primary-button"
          onClick={onAddSpend}
        >
          ＋ Log your first spend (+2 ✦)
        </button>

        {showDevArt && (
          <button
            type="button"
            className="dark-button dev-art-button"
            onClick={onPreviewArt}
            title="Preview celebration animation (debug mode)"
            style={{ marginTop: '8px' }}
          >
            ✦ Preview Art
          </button>
        )}
      </div>
    </div>
  )
}
