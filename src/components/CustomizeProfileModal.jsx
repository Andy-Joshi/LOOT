import React, { useState } from 'react'
import { adjustOpeningBalance } from '../services/moneyEngine'
import AnimatedNumber from './AnimatedNumber'
import './CustomizeProfileModal.css'

const ACCENT_SWATCHES = [
  { id: 'lime', label: 'Neon Lime', color: '#67ff3a' },
  { id: 'purple', label: 'Arcade Purple', color: '#8a4dff' },
  { id: 'cyan', label: 'Electric Cyan', color: '#00e5ff' },
  { id: 'pink', label: 'Hot Pink', color: '#ff4da6' },
  { id: 'yellow', label: 'Cyber Gold', color: '#ffbe26' }
]

export default function CustomizeProfileModal({
  profile = {},
  form = { profile: {} },
  updateForm,
  saveProfile,
  switchExperienceMode,
  isNewUser,
  closeModal,
  onReplaySplash,
  accountingState = {},
  notify
}) {
  const [adjAmount, setAdjAmount] = useState('')
  const [adjReason, setAdjReason] = useState('')
  const [showAdjForm, setShowAdjForm] = useState(false)
  const [adjSubmitting, setAdjSubmitting] = useState(false)

  const currentAccent = form.profile.accent || profile.accent || 'lime'
  const currentName = form.profile.name !== undefined ? form.profile.name : (profile.name || '')
  const currentAvatar = (
    form.profile.avatar ||
    (currentName ? currentName.trim()[0] : '') ||
    profile.avatar ||
    (isNewUser ? 'R' : 'A')
  ).slice(0, 1).toUpperCase()

  const handleNameChange = (e) => {
    const newName = e.target.value
    updateForm('profile', 'name', newName)
    // If avatar letter is empty or matches previous first letter, update it with new initial
    if (!form.profile.avatar && newName.trim()) {
      updateForm('profile', 'avatar', newName.trim()[0].toUpperCase())
    }
  }

  const handleAccentSelect = (accentId) => {
    updateForm('profile', 'accent', accentId)
  }

  const handleAvatarLetterChange = (e) => {
    const val = e.target.value.slice(-1).toUpperCase()
    updateForm('profile', 'avatar', val)
  }

  const handleAdjustOpeningBalance = async (e) => {
    e.preventDefault()
    const amt = Number(adjAmount)
    if (isNaN(amt) || amt < 0) {
      if (notify) notify('Please enter a valid opening balance (₹0 or greater).')
      return
    }

    setAdjSubmitting(true)
    try {
      await adjustOpeningBalance(amt, adjReason)
      try {
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ openingBalance: amt })
        })
      } catch {
        // Safe offline fallback
      }
      if (notify) notify(`Opening balance adjusted to ₹${amt.toLocaleString('en-IN')}!`)
      setShowAdjForm(false)
      setAdjAmount('')
      setAdjReason('')
    } catch (err) {
      if (notify) notify(err.message || 'Failed to adjust opening balance.')
    } finally {
      setAdjSubmitting(false)
    }
  }

  return (
    <div className="cpm-modal-container" role="dialog" aria-modal="true" aria-labelledby="cpm-title">
      {/* 1. Header */}
      <div className="cpm-header">
        <div>
          <span className="section-kicker">PLAYER CARD & EXPERIENCE</span>
          <h2 id="cpm-title">Customize Player Card</h2>
          <p className="cpm-subhead">Switch game mode and personalize your LOOT identity.</p>
        </div>
        <button
          type="button"
          className="cpm-close-btn"
          onClick={closeModal}
          aria-label="Close Profile Customizer"
        >
          ✕
        </button>
      </div>

      {/* 2. Scrollable Body Content */}
      <form id="profile-customizer-form" onSubmit={saveProfile} className="cpm-form">
        <div className="cpm-scroll-body">
          {/* Section: Experience Mode (Two Wide Side-by-Side Cards) */}
          <div className="cpm-section">
            <div className="cpm-section-title-row">
              <span className="cpm-section-kicker">GAME MODE</span>
              <span className="cpm-section-tip">Select how you want to play</span>
            </div>

            <div className="cpm-mode-grid">
              {/* Option 1: Rookie Journey (Fresh Start) */}
              <div
                className={`cpm-mode-card ${isNewUser ? 'selected' : ''}`}
                onClick={() => switchExperienceMode('new_user')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') switchExperienceMode('new_user') }}
              >
                <div className="cpm-mode-card-head">
                  <div className="cpm-mode-icon-title">
                    <span className="cpm-mode-emoji">🌱</span>
                    <div>
                      <strong className="cpm-mode-name">Rookie Journey</strong>
                      <span className="cpm-mode-badge rookie">FRESH START</span>
                    </div>
                  </div>
                  <div className={`cpm-check-indicator ${isNewUser ? 'active' : ''}`}>
                    {isNewUser ? '✓' : ''}
                  </div>
                </div>
                <p className="cpm-mode-desc">Fresh Start: begin from zero.</p>
              </div>

              {/* Option 2: Loaded Vault (Test User) */}
              <div
                className={`cpm-mode-card ${!isNewUser ? 'selected' : ''}`}
                onClick={() => switchExperienceMode('test_user')}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') switchExperienceMode('test_user') }}
              >
                <div className="cpm-mode-card-head">
                  <div className="cpm-mode-icon-title">
                    <span className="cpm-mode-emoji">⚡</span>
                    <div>
                      <strong className="cpm-mode-name">Loaded Vault</strong>
                      <span className="cpm-mode-badge test-user">TEST USER</span>
                    </div>
                  </div>
                  <div className={`cpm-check-indicator ${!isNewUser ? 'active' : ''}`}>
                    {!isNewUser ? '✓' : ''}
                  </div>
                </div>
                <p className="cpm-mode-desc">Test User: preloaded demo data.</p>
              </div>
            </div>
          </div>

          {/* Section: Live Avatar & Player Preview */}
          <div className="cpm-section">
            <div className="cpm-section-title-row">
              <span className="cpm-section-kicker">PLAYER IDENTITY</span>
            </div>

            <div className="cpm-player-preview-card">
              <div className="cpm-avatar-interactive-wrap">
                <div
                  key={`${currentAvatar}-${currentAccent}`}
                  className={`cpm-live-avatar ${currentAccent} pulse-on-mount`}
                  title="Live Avatar Preview"
                >
                  {currentAvatar}
                </div>
                <div className="cpm-avatar-edit-chip">
                  <label htmlFor="cpm-avatar-input" className="cpm-avatar-label">
                    Letter:
                  </label>
                  <input
                    id="cpm-avatar-input"
                    className="cpm-avatar-letter-input"
                    maxLength={1}
                    value={currentAvatar}
                    onChange={handleAvatarLetterChange}
                    aria-label="Avatar Letter"
                  />
                </div>
              </div>

              <div className="cpm-player-preview-info">
                <strong className="cpm-preview-name">
                  {currentName || 'Player One'}
                </strong>
                <span className="cpm-preview-meta">
                  {profile.rank || 'Saving Rookie'} · {profile.coins || 0} LOOT Coins
                </span>
                <span className="cpm-accent-indicator">
                  Accent: <b>{currentAccent}</b>
                </span>
              </div>
            </div>
          </div>

          {/* Section: Accent Color Swatches */}
          <div className="cpm-section">
            <span className="cpm-section-kicker">ACCENT COLOR</span>
            <div className="cpm-swatches-row" role="radiogroup" aria-label="Accent colors">
              {ACCENT_SWATCHES.map(swatch => {
                const isSelected = currentAccent === swatch.id
                return (
                  <button
                    key={swatch.id}
                    type="button"
                    className={`cpm-swatch-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => handleAccentSelect(swatch.id)}
                    role="radio"
                    aria-checked={isSelected}
                    title={swatch.label}
                  >
                    <span
                      className="cpm-swatch-dot"
                      style={{ backgroundColor: swatch.color }}
                    />
                    <span className="cpm-swatch-label">{swatch.label}</span>
                    {isSelected && <span className="cpm-swatch-check">✓</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Section: Form Fields */}
          <div className="cpm-section cpm-fields-group">
            <div className="cpm-field">
              <label htmlFor="cpm-display-name">Display name</label>
              <input
                id="cpm-display-name"
                required
                className="cpm-input"
                value={currentName}
                onChange={handleNameChange}
                placeholder="e.g. Maya Shah"
              />
            </div>

            <div className="cpm-field">
              <label htmlFor="cpm-email">Email label</label>
              <input
                id="cpm-email"
                type="email"
                className="cpm-input"
                value={form.profile.email !== undefined ? form.profile.email : (profile.email || '')}
                onChange={e => updateForm('profile', 'email', e.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <div className="cpm-field">
              <label htmlFor="cpm-weekly-budget">Weekly spending budget (₹)</label>
              <input
                id="cpm-weekly-budget"
                type="number"
                min="0"
                step="100"
                className="cpm-input"
                value={form.profile.weeklyBudget !== undefined ? form.profile.weeklyBudget : (profile.weeklyBudget || '')}
                onChange={e => updateForm('profile', 'weeklyBudget', e.target.value === '' ? null : Number(e.target.value))}
                placeholder="e.g. 2000"
              />
            </div>

            <div className="cpm-field">
              <label htmlFor="cpm-bio">One-line bio</label>
              <textarea
                id="cpm-bio"
                className="cpm-input cpm-textarea"
                rows={2}
                value={form.profile.bio !== undefined ? form.profile.bio : (profile.bio || '')}
                onChange={e => updateForm('profile', 'bio', e.target.value)}
                placeholder="Saving for something big..."
              />
            </div>

            {onReplaySplash && (
              <div className="cpm-replay-row">
                <button
                  type="button"
                  className="secondary-button cpm-replay-btn"
                  onClick={onReplaySplash}
                >
                  <span>🎬</span> Replay Splash Intro (~4s)
                </button>
              </div>
            )}
          </div>

          {/* Section: Opening Balance & Auditable Adjustment */}
          <div className="cpm-section cpm-opening-balance-section">
            <div className="cpm-section-title-row">
              <span className="cpm-section-kicker">CENTRAL MONEY ENGINE</span>
              <span className="cpm-section-tip">Auditable baseline</span>
            </div>

            <div className="cpm-opening-card">
              <div className="cpm-opening-row">
                <div>
                  <strong className="cpm-opening-val">
                    ₹<AnimatedNumber value={accountingState.openingBalance || 0} formatIndian={true} />
                  </strong>
                  <span className="cpm-opening-label">Current Opening Balance</span>
                </div>
                <button
                  type="button"
                  className="secondary-button cpm-adjust-btn"
                  onClick={() => setShowAdjForm(!showAdjForm)}
                >
                  {showAdjForm ? 'Close Adjustment ▴' : 'Edit Opening Balance ▾'}
                </button>
              </div>

              {showAdjForm && (
                <div className="cpm-adj-form-drawer">
                  <div className="cpm-field">
                    <label htmlFor="cpm-adj-amount">New Opening Balance (₹)</label>
                    <input
                      id="cpm-adj-amount"
                      type="number"
                      step="any"
                      min="0"
                      className="cpm-input"
                      placeholder="e.g. 500.00"
                      value={adjAmount}
                      onChange={e => setAdjAmount(e.target.value)}
                    />
                  </div>
                  <div className="cpm-field">
                    <label htmlFor="cpm-adj-reason">Audit Reason</label>
                    <input
                      id="cpm-adj-reason"
                      type="text"
                      className="cpm-input"
                      placeholder="e.g. Statement reconciliation / found cash"
                      value={adjReason}
                      onChange={e => setAdjReason(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    className="primary-button cpm-submit-adj-btn"
                    disabled={adjSubmitting}
                    onClick={handleAdjustOpeningBalance}
                  >
                    {adjSubmitting ? 'Recording Audit...' : 'Save Auditable Adjustment'}
                  </button>
                </div>
              )}

              {/* Audit history */}
              {accountingState.adjustments && accountingState.adjustments.length > 0 && (
                <div className="cpm-adj-history">
                  <span className="cpm-history-title">ADJUSTMENT AUDIT HISTORY</span>
                  {accountingState.adjustments.map(adj => (
                    <div key={adj.id} className="cpm-adj-history-item">
                      <span>{adj.date}:</span>
                      <b>₹{adj.previousAmount} → ₹{adj.newAmount} ({adj.difference >= 0 ? '+' : ''}₹{adj.difference})</b>
                      <small>— {adj.reason}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Sticky Footer with Save & Cancel Buttons */}
        <div className="cpm-footer">
          <button
            type="button"
            className="secondary-button cpm-cancel-btn"
            onClick={closeModal}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary-button cpm-save-btn"
          >
            Save player card
          </button>
        </div>
      </form>
    </div>
  )
}
