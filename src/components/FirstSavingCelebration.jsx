import React, { useId, useEffect } from 'react'
import './FirstSavingCelebration.css'

/**
 * FirstSavingCelebration Component
 *
 * Neon cyber celebration triggered when the user makes their first savings contribution towards a goal.
 * Features a glowing cyber safe, laser-engraved coin slot, animated dropping LOOT coin,
 * dynamic shockwaves, and reward summaries.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen
 * @param {Object} [props.goal] - Goal details saved towards
 * @param {number} [props.amount=50] - Amount saved
 * @param {number} [props.coinsEarned=1] - Coins rewarded
 * @param {Function} props.onClose
 */
export default function FirstSavingCelebration({
  isOpen,
  goal,
  amount = 50,
  coinsEarned = 1,
  onClose
}) {
  const rawId = useId()
  const p = `fs-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-`

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const goalName = goal?.name || 'Emergency Fund'
  const goalTarget = Number(goal?.target) || 500

  return (
    <div
      className="saving-celebration-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="First Saving Locked In Celebration"
    >
      <div className="saving-celebration-card" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="saving-celebration-close"
          onClick={onClose}
          title="Close celebration"
        >
          ×
        </button>

        <span className="saving-kicker">✦ SAVINGS MILESTONE UNLOCKED ✦</span>
        <h2 className="saving-title">First Deposit Locked In!</h2>

        <div className="saving-stage">
          <svg
            className="saving-svg"
            viewBox="0 0 400 360"
            role="img"
            aria-label="Neon Cyber Vault Deposit Animation"
          >
            <defs>
              <linearGradient id={`${p}g1`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#67ff3a" />
                <stop offset="100%" stopColor="#8a4dff" />
              </linearGradient>

              <radialGradient id={`${p}vaultGrad`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1e3422" />
                <stop offset="70%" stopColor="#0c170f" />
                <stop offset="100%" stopColor="#060c07" />
              </radialGradient>

              <radialGradient id={`${p}coinGrad`} cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="35%" stopColor="#c8ff3d" />
                <stop offset="75%" stopColor="#67ff3a" />
                <stop offset="100%" stopColor="#1e6b10" />
              </radialGradient>

              <filter id={`${p}neonGlow`}>
                <feGaussianBlur stdDeviation="6" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Concentric Neon Shockwaves */}
            <circle className="fsc-wave" cx="200" cy="220" r="50" fill="none" strokeWidth="2.5" />
            <circle className="fsc-wave" cx="200" cy="220" r="50" fill="none" strokeWidth="2.5" style={{ animationDelay: '0.8s' }} />

            {/* Dropping Neon Coin */}
            <g className="fsc-coin">
              <circle cx="200" cy="80" r="32" fill={`url(#${p}coinGrad)`} stroke="#ffffff" strokeWidth="2.5" filter={`url(#${p}neonGlow)`} />
              <text x="200" y="88" fill="#061107" fontSize="22" fontWeight="900" fontFamily="DM Mono, monospace" textAnchor="middle">
                ✦
              </text>
            </g>

            {/* Cyber Safe Vault */}
            <g className="fsc-vault">
              {/* Outer Safe Chassis */}
              <rect x="110" y="140" width="180" height="160" rx="28" fill={`url(#${p}vaultGrad)`} stroke={`url(#${p}g1)`} strokeWidth="3.5" />

              {/* Safe Coin Deposit Slot */}
              <rect x="160" y="152" width="80" height="10" rx="5" fill="#040805" stroke="#67ff3a" strokeWidth="2" />

              {/* Rotating Laser Lock Mechanism */}
              <g className="fsc-lock-ring">
                <circle cx="200" cy="225" r="45" fill="none" stroke="#8a4dff" strokeWidth="2.5" strokeDasharray="16 10" />
                <circle cx="200" cy="225" r="32" fill="#0b120c" stroke="#67ff3a" strokeWidth="3" />
              </g>

              {/* Center Keyhole / Shield Icon */}
              <circle cx="200" cy="225" r="16" fill="#67ff3a" />
              <text x="200" y="231" fill="#061007" fontSize="16" fontWeight="900" textAnchor="middle">
                🔒
              </text>
            </g>
          </svg>
        </div>

        <div className="saving-details-box">
          <div className="saving-details-row">
            <span>Target Goal:</span>
            <strong>{goalName}</strong>
          </div>
          <div className="saving-details-row">
            <span>Amount Saved:</span>
            <strong style={{ color: '#67ff3a' }}>+₹{Number(amount).toLocaleString('en-IN')}</strong>
          </div>
          <div className="saving-details-row">
            <span>Goal Progress:</span>
            <strong>₹{Number(amount).toLocaleString('en-IN')} / ₹{goalTarget.toLocaleString('en-IN')}</strong>
          </div>
        </div>

        <div className="saving-reward-badge">
          +{coinsEarned} LOOT Coins Earned!
        </div>

        <div className="saving-actions">
          <button type="button" className="saving-btn-primary" onClick={onClose}>
            Keep Building →
          </button>
        </div>
      </div>
    </div>
  )
}
