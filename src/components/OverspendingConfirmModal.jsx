import React from 'react'
import AnimatedNumber from './AnimatedNumber'
import './OverspendingConfirmModal.css'

/**
 * OverspendingConfirmModal Component
 *
 * Implements requirement 3:
 * Headline: "Whoa! You're going beyond your balance."
 * Displays:
 * - Current available balance
 * - Requested transaction amount
 * - Amount exceeding available balance (Shortfall)
 * Two actions:
 * A. Cancel Transaction
 * B. Continue Anyway
 */
export default function OverspendingConfirmModal({
  isOpen,
  availableBalance = 0,
  requestedAmount = 0,
  shortfallAmount = 0,
  transactionTitle = '',
  onCancel,
  onContinue
}) {
  if (!isOpen) return null

  return (
    <div className="overspend-overlay" role="alertdialog" aria-modal="true" aria-labelledby="overspend-title">
      <div className="overspend-card">
        {/* Warning Icon Badge */}
        <div className="overspend-icon-wrap">
          <span className="overspend-alert-icon">⚠️</span>
          <span className="overspend-kicker">OVERDRAFT WARNING</span>
        </div>

        <h2 id="overspend-title" className="overspend-title">
          Whoa! You're going beyond your balance.
        </h2>

        <p className="overspend-desc">
          You're about to log an expense of <b>₹{requestedAmount.toLocaleString('en-IN')}</b> for <i>"{transactionTitle || 'Expense'}"</i>, but you only have <b>₹{availableBalance.toLocaleString('en-IN')}</b> in available cash.
        </p>

        {/* 3-Stat Overdraft Calculation Breakdown */}
        <div className="overspend-math-box">
          <div className="overspend-math-row">
            <div className="math-col">
              <span className="math-label">Available Balance</span>
              <strong className="math-val lime">
                ₹<AnimatedNumber value={availableBalance} formatIndian={true} />
              </strong>
            </div>

            <span className="math-operator">−</span>

            <div className="math-col">
              <span className="math-label">Requested Spend</span>
              <strong className="math-val red">
                ₹<AnimatedNumber value={requestedAmount} formatIndian={true} />
              </strong>
            </div>

            <span className="math-operator">=</span>

            <div className="math-col shortfall-col">
              <span className="math-label">Shortfall Deficit</span>
              <strong className="math-val alert">
                ₹<AnimatedNumber value={shortfallAmount} formatIndian={true} />
              </strong>
            </div>
          </div>
        </div>

        {/* Information Callout */}
        <div className="overspend-consequence-box">
          <div className="consequence-bullet">
            <span>•</span>
            <p>Your available cash balance will be set to <b>₹0.00</b>.</p>
          </div>
          <div className="consequence-bullet">
            <span>•</span>
            <p>An outstanding shortfall of <b>₹{shortfallAmount.toLocaleString('en-IN')}</b> will be logged.</p>
          </div>
          <div className="consequence-bullet">
            <span>•</span>
            <p>Any incoming money will automatically settle this shortfall first.</p>
          </div>
        </div>

        {/* Actions: Cancel vs Continue Anyway */}
        <div className="overspend-actions">
          <button
            type="button"
            className="secondary-button overspend-cancel-btn"
            onClick={onCancel}
          >
            Cancel Transaction
          </button>
          <button
            type="button"
            className="primary-button overspend-continue-btn"
            onClick={onContinue}
          >
            Continue Anyway (Create Shortfall)
          </button>
        </div>
      </div>
    </div>
  )
}
