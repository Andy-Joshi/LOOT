import React, { useState } from 'react'
import LootLogo from './LootLogo'
import AnimatedNumber from './AnimatedNumber'
import { setOnboardingOpeningBalance } from '../services/moneyEngine'
import { playCelebrationSound, playCoinSound } from '../utils/sfx'
import './WalletOnboardingModal.css'

const PRESET_AMOUNTS = [
  { label: 'Fresh Start (₹0)', value: 0 },
  { label: '₹250', value: 250 },
  { label: '₹500', value: 500 },
  { label: '₹1,000', value: 1000 },
  { label: '₹2,500', value: 2500 }
]

export default function WalletOnboardingModal({ onComplete }) {
  const [amountStr, setAmountStr] = useState('500')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAmountChange = (e) => {
    const val = e.target.value
    setAmountStr(val)
    if (error) setError('')
  }

  const handleSelectPreset = (presetVal) => {
    setAmountStr(String(presetVal))
    if (error) setError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const parsed = Number(amountStr)
    if (amountStr.trim() === '' || isNaN(parsed) || parsed < 0) {
      setError('Please enter a valid amount (₹0 or any positive balance).')
      return
    }

    setIsSubmitting(true)
    playCelebrationSound()
    playCoinSound()

    try {
      await setOnboardingOpeningBalance(parsed)
      try {
        await fetch('/api/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ openingBalance: parsed })
        })
      } catch {
        // Safe offline fallback
      }
      if (onComplete) {
        onComplete(parsed)
      }
    } catch (err) {
      setError(err.message || 'Failed to save opening balance.')
      setIsSubmitting(false)
    }
  }

  const numericPreview = Math.max(0, Number(amountStr) || 0)

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-headline">
      <div className="onboarding-card">
        {/* Glow & Logo */}
        <div className="onboarding-badge-wrap">
          <LootLogo intro={false} showWordmark={false} size="sm" />
          <span className="onboarding-kicker">WALLET INITIALIZATION</span>
        </div>

        <h1 id="onboarding-headline" className="onboarding-title">
          Let's set up your wallet.
        </h1>
        <p className="onboarding-subtitle">
          How much money do you currently have?
        </p>

        <form onSubmit={handleSubmit} className="onboarding-form">
          {/* Prominent INR Input Field */}
          <div className={`onboarding-input-box ${error ? 'has-error' : ''}`}>
            <span className="onboarding-currency-symbol">₹</span>
            <input
              id="onboarding-inr-input"
              type="number"
              step="any"
              min="0"
              autoFocus
              className="onboarding-inr-input"
              placeholder="0.00"
              value={amountStr}
              onChange={handleAmountChange}
              aria-label="Starting money amount in rupees"
              disabled={isSubmitting}
            />
          </div>

          {error && <p className="onboarding-error-msg" role="alert">⚠️ {error}</p>}

          {/* Preset Quick Chips */}
          <div className="onboarding-presets">
            {PRESET_AMOUNTS.map(preset => (
              <button
                key={preset.value}
                type="button"
                className={`onboarding-preset-chip ${Number(amountStr) === preset.value ? 'active' : ''}`}
                onClick={() => handleSelectPreset(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Live Preview Information */}
          <div className="onboarding-preview-pill">
            <span className="preview-label">Starting Cash Balance:</span>
            <strong className="preview-val">
              ₹<AnimatedNumber value={numericPreview} formatIndian={true} />
            </strong>
          </div>

          {/* Continue Button */}
          <button
            type="submit"
            className="primary-button onboarding-continue-btn pulse"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Initializing Vault...' : 'Continue to LOOT →'}
          </button>
        </form>

        <p className="onboarding-footer-note">
          You can adjust your baseline balance anytime in <b>Profile → Opening Balance</b> with full audit tracking.
        </p>
      </div>
    </div>
  )
}
