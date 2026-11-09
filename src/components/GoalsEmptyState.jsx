import React, { useId } from 'react'
import { isDebugMode } from '../utils/debug'

/**
 * GoalsEmptyState Component
 *
 * Implements Phase 4 requirement:
 * "create-goal-animation.html: use as the Goals empty state and when a goal is created."
 * Embeds the exact SVG clipboard & checklist animation elements as the interactive empty state.
 *
 * @param {Object} props
 * @param {Function} props.onCreateGoal - Callback to open create goal modal
 * @param {Function} [props.onPreviewArt] - Callback to play full celebration
 */
export default function GoalsEmptyState({ onCreateGoal, onPreviewArt }) {
  const rawId = useId()
  const p = `ges-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-`

  return (
    <div
      className="empty-state-card card"
      style={{
        gridColumn: '1 / -1',
        padding: '36px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        background: 'radial-gradient(circle at 50% 25%, rgba(138, 77, 255, 0.12), rgba(10, 15, 11, 0.95) 75%)',
        border: '1px solid rgba(138, 77, 255, 0.35)',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.6), 0 0 30px rgba(138, 77, 255, 0.12)'
      }}
    >
      <div style={{ width: '160px', height: '170px', marginBottom: '16px' }}>
        <svg
          viewBox="70 50 260 310"
          width="100%"
          height="100%"
          role="img"
          aria-label="Goals empty state artwork"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <linearGradient id={`${p}rg`} gradientUnits="userSpaceOnUse" x1="-107" x2="107">
              <stop offset="0" stopColor="#8a4dff" />
              <stop offset="1" stopColor="#67ff3a" />
            </linearGradient>
            <linearGradient id={`${p}ce`} gradientUnits="userSpaceOnUse" x1="-80" y1="80" x2="80" y2="-80">
              <stop offset="0" stopColor="#7dff3a" />
              <stop offset=".55" stopColor="#5fb87a" />
              <stop offset="1" stopColor="#8a4dff" />
            </linearGradient>
            <linearGradient id={`${p}cb2`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#0b3414" />
              <stop offset=".6" stopColor="#0a1810" />
              <stop offset="1" stopColor="#1a0f40" />
            </linearGradient>
            <linearGradient id={`${p}bg`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#67ff3a" />
              <stop offset="1" stopColor="#8a4dff" />
            </linearGradient>
          </defs>

          {/* Glowing Halo */}
          <circle cx="200" cy="175" r="110" fill="#67ff3a" opacity="0.08" />

          {/* Orbital Ring */}
          <g transform="translate(198 167) rotate(-17)">
            <path d="M-100 0A100 30 0 1 1 100 0A100 30 0 1 1 -100 0" fill="none" stroke={`url(#${p}rg)`} strokeWidth="3" opacity="0.6" />
          </g>

          {/* Central Clipboard */}
          <g transform="translate(191 168) rotate(-6)">
            <rect x="-74" y="-76" width="150" height="155" rx="22" fill="#05140a" stroke="#1e6a2a" strokeWidth="3" opacity=".8" />
            <rect x="-78" y="-80" width="150" height="155" rx="22" fill={`url(#${p}cb2)`} stroke={`url(#${p}ce)`} strokeWidth="3.5" />

            {/* Top Clipboard Tab */}
            <rect x="-34" y="-96" width="68" height="28" rx="9" fill="#0a2a12" stroke={`url(#${p}ce)`} strokeWidth="3" />
            <rect x="-16" y="-108" width="32" height="16" rx="7" fill="#0a2a12" stroke="#67ff3a" strokeWidth="2.5" />

            {/* Checklist Rows */}
            <g transform="translate(0, 0)">
              {/* Row 1 */}
              <rect x="-45" y="-45" width="24" height="24" rx="7" fill="#0f3a1a" stroke="#7dff5a" strokeWidth="2.5" />
              <path d="M-39 -33L-34 -28L-27 -37" fill="none" stroke="#67ff3a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="-12" y="-42" width="56" height="5" rx="2.5" fill="#6a56c8" />
              <rect x="-10" y="-30" width="36" height="5" rx="2.5" fill="#6a56c8" />

              {/* Row 2 */}
              <rect x="-40" y="-12" width="24" height="24" rx="7" fill="#12102a" stroke="#8a4dff" strokeWidth="2.5" />
              <rect x="-6" y="-9" width="54" height="5" rx="2.5" fill="#8a4dff" opacity="0.8" />
              <rect x="-4" y="3" width="32" height="5" rx="2.5" fill="#8a4dff" opacity="0.8" />

              {/* Row 3 */}
              <rect x="-34" y="21" width="24" height="24" rx="7" fill="#12102a" stroke="#7a63d8" strokeWidth="2.5" />
              <rect x="0" y="24" width="32" height="5" rx="2.5" fill="#6a56c8" opacity=".6" />
            </g>
          </g>

          {/* Plus Action Button */}
          <g transform="translate(254 218) rotate(-8)">
            <rect x="-26" y="-26" width="52" height="52" rx="15" fill={`url(#${p}bg)`} stroke="#c4ffa0" strokeWidth="2.5" />
            <rect x="-18" y="-18" width="36" height="36" rx="10" fill="#0d3f18" />
            <rect x="-11" y="-3" width="22" height="6" rx="3" fill="#fff" />
            <rect x="-3" y="-11" width="6" height="22" rx="3" fill="#fff" />
          </g>
        </svg>
      </div>

      <h3 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: '800', color: '#f2f8f1' }}>
        No saving missions created
      </h3>
      <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#a4b8a6', maxWidth: '420px', lineHeight: '1.5' }}>
        Turn small saves into big wins. Set your first goal to earn <strong style={{ color: '#67ff3a' }}>+10 LOOT Coins</strong> immediately!
      </p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          className="primary-button"
          onClick={onCreateGoal}
          style={{ padding: '12px 22px', fontSize: '14px' }}
        >
          ＋ Create your first goal (+10 ✦)
        </button>
        {isDebugMode() && onPreviewArt && (
          <button
            type="button"
            className="secondary-button"
            onClick={onPreviewArt}
            style={{ padding: '12px 18px', fontSize: '13px' }}
          >
            ✦ Preview Art
          </button>
        )}
      </div>
    </div>
  )
}
