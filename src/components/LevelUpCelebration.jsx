import React, { useEffect } from 'react'
import './LevelUpCelebration.css'

/**
 * LevelUpCelebration Component
 *
 * Full-screen arcade takeover overlay triggered when the user achieves a new LOOT Level.
 * Features a badge slam-in animation, sonic ring ripples, XP fill animation, and perk reveals.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the takeover modal is open
 * @param {number} props.level - New level achieved (e.g., 2)
 * @param {string} props.rank - Rank title (e.g., "Cash Commander")
 * @param {Array<string>} [props.unlockedPerks] - Unlocked perks list
 * @param {Function} props.onClose - Dismiss callback
 */
export default function LevelUpCelebration({
  isOpen,
  level = 2,
  rank = 'Cash Commander',
  unlockedPerks = ['Double Coin Weekends', 'Custom Neon Avatar Borders', 'Exclusive Store Discounts'],
  onClose
}) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="levelup-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Level Up Celebration"
    >
      <div className="levelup-modal" onClick={e => e.stopPropagation()}>
        <span className="levelup-kicker">✦ RANK PROMOTION ✦</span>
        <h2 className="levelup-title">LEVEL UP!</h2>
        <div className="levelup-rank-title">Rank: {rank}</div>

        <div className="levelup-badge-wrapper">
          <div className="levelup-ripple" />
          <div className="levelup-badge">
            <span className="levelup-badge-icon">⚡</span>
            <span className="levelup-badge-lvl">LVL {level}</span>
          </div>
        </div>

        <div className="levelup-xp-box">
          <div className="levelup-xp-header">
            <span>XP PROGRESSION</span>
            <span>1,000 / 1,000 XP (MAX)</span>
          </div>
          <div className="levelup-xp-track">
            <div className="levelup-xp-fill" />
          </div>
        </div>

        <div className="levelup-perks">
          <div style={{ fontSize: '11px', fontFamily: 'DM Mono, monospace', color: '#8a4dff', fontWeight: '700', marginBottom: '2px', textAlign: 'left' }}>
            UNLOCKED PRIVILEGES:
          </div>
          {unlockedPerks.map((perk, idx) => (
            <div key={idx} className="levelup-perk-item">
              <span>✓</span> {perk}
            </div>
          ))}
        </div>

        <button type="button" className="levelup-button" onClick={onClose}>
          Claim Rewards & Continue →
        </button>
      </div>
    </div>
  )
}
