import React, { useState } from 'react'
import ModalShell from './ModalShell'
import AnimatedNumber from './AnimatedNumber'
import { calculateSplitProgress } from '../services/splitService'
import './SplitDetailsModal.css'

/**
 * SplitDetailsModal Component (Split Bills 2.0)
 *
 * Full bill settlement tracking interface:
 * - Displays individual amounts, payment statuses (Pending vs Paid)
 * - Settlement metrics (Total settled, Remaining, Progress %)
 * - Confirmation flow before marking participants as paid
 * - Automated completion check, celebratory banner & LOOT Coin award (+25 ✦)
 *
 * @param {Object} props
 * @param {Object} props.split - Split bill object
 * @param {Function} props.closeModal - Modal dismissal handler
 * @param {Function} props.onToggleParticipantPaid - Handler (splitId, participantIndex, paid) => Promise
 * @param {Function} props.onSettleAll - Handler (splitId) => Promise
 * @param {Function} [props.onDeleteSplit] - Handler (splitId) => Promise
 */
export default function SplitDetailsModal({
  split,
  closeModal,
  onToggleParticipantPaid,
  onSettleAll,
  onDeleteSplit
}) {
  const [confirmParticipant, setConfirmParticipant] = useState(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showCelebrationNotice, setShowCelebrationNotice] = useState(false)

  if (!split) return null

  const progress = calculateSplitProgress(split)
  const participants = Array.isArray(split.participants) ? split.participants : []

  const handleMarkPaidClick = (p, idx) => {
    setConfirmParticipant({ ...p, idx })
  }

  const handleConfirmPaid = async () => {
    if (!confirmParticipant) return
    setIsUpdating(true)
    try {
      const res = await onToggleParticipantPaid(split.id, confirmParticipant.idx, true)
      if (res?.coinsAwarded > 0 || res?.isNewlySettled) {
        setShowCelebrationNotice(true)
      }
    } catch {
      // Error handled by parent notify
    } finally {
      setIsUpdating(false)
      setConfirmParticipant(null)
    }
  }

  const handleSettleAll = async () => {
    setIsUpdating(true)
    try {
      const res = await onSettleAll(split.id)
      if (res?.coinsAwarded > 0 || res?.isNewlySettled) {
        setShowCelebrationNotice(true)
      }
    } catch {
      // Error handled by parent notify
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete the split bill "${split.title}"?`)) {
      if (onDeleteSplit) onDeleteSplit(split.id)
      closeModal()
    }
  }

  return (
    <ModalShell title={split.title} kicker="BILL SETTLEMENT DETAILS" closeModal={closeModal}>
      <div className="split-details-container">
        {/* Full Settlement Celebratory Banner */}
        {(progress.isFullySettled || showCelebrationNotice) && (
          <div className="settlement-success-banner" role="alert">
            <span className="success-icon">🎉</span>
            <div className="success-copy">
              <strong>Bill settled! You&apos;re a Smart Spender.</strong>
              <p>Every participant has settled their share. Great financial leadership!</p>
              <div className="success-reward-badge">
                <span>✦ REWARD UNLOCKED:</span> <b>+25 LOOT Coins</b>
              </div>
            </div>
          </div>
        )}

        {/* Top Overview Bar */}
        <div className="split-overview-bar">
          <div className="overview-title-block">
            <span className="split-mode-pill">
              {split.mode === 'custom' ? '✎ Custom Split' : '➗ Equal Split'}
            </span>
            <span className={`split-status-badge ${progress.statusKey}`}>
              {progress.status}
            </span>
          </div>

          <div className="overview-total-block">
            <span className="total-label">Total Bill</span>
            <strong className="total-value">
              ₹<AnimatedNumber value={split.total} formatIndian />
            </strong>
          </div>
        </div>

        {/* Progress Bar & Settlement Metrics */}
        <div className="settlement-metrics-card">
          <div className="metrics-row">
            <div className="metric-box">
              <span className="m-label">SETTLED</span>
              <strong className="m-val settled">₹{progress.settledAmount.toLocaleString('en-IN')}</strong>
            </div>
            <div className="metric-box">
              <span className="m-label">OUTSTANDING</span>
              <strong className="m-val remaining">₹{progress.remainingAmount.toLocaleString('en-IN')}</strong>
            </div>
            <div className="metric-box">
              <span className="m-label">PROGRESS</span>
              <strong className="m-val pct">{progress.progressPercent}%</strong>
            </div>
          </div>

          <div className="progress-track-wrap">
            <div
              className={`progress-fill ${progress.isFullySettled ? 'fully-settled' : ''}`}
              style={{ width: `${progress.progressPercent}%` }}
            />
          </div>

          <div className="progress-foot-note">
            <span>
              {progress.paidCount} of {progress.totalCount} {progress.totalCount === 1 ? 'participant' : 'participants'} settled
            </span>
            {split.settledAt && (
              <span className="settled-date">
                Settled on {new Date(split.settledAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>

        {/* Confirmation Prompt Popup / Banner */}
        {confirmParticipant && (
          <div className="payment-confirm-card">
            <div className="confirm-header">
              <span className="confirm-icon">✓</span>
              <strong>Record payment for {confirmParticipant.name}?</strong>
            </div>
            <p className="confirm-desc">
              Confirm that <b>{confirmParticipant.name}</b> has paid their share of{' '}
              <strong className="confirm-amount">₹{Number(confirmParticipant.amount).toLocaleString('en-IN')}</strong>.
            </p>
            <small className="confirm-disclaimer">
              * Payment tracking only. LOOT logs member settlements without executing third-party banking transfers.
            </small>
            <div className="confirm-actions">
              <button
                type="button"
                className="primary-button btn-confirm"
                onClick={handleConfirmPaid}
                disabled={isUpdating}
              >
                {isUpdating ? 'Saving...' : 'Yes, Mark as Paid'}
              </button>
              <button
                type="button"
                className="secondary-button btn-cancel"
                onClick={() => setConfirmParticipant(null)}
                disabled={isUpdating}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Participant Settlement Checklist */}
        <div className="participants-section">
          <div className="section-head-row">
            <span className="participants-kicker">PARTICIPANT BREAKDOWN</span>
            {!progress.isFullySettled && participants.length > 1 && (
              <button
                type="button"
                className="settle-all-btn"
                onClick={handleSettleAll}
                disabled={isUpdating}
              >
                ✓ Settle All ({progress.totalCount - progress.paidCount} remaining)
              </button>
            )}
          </div>

          <div className="participant-items-list">
            {participants.map((p, idx) => {
              const isPaid = Boolean(p.paid)
              return (
                <div
                  key={p.id || `${p.name}-${idx}`}
                  className={`participant-item-row ${isPaid ? 'paid' : 'pending'}`}
                >
                  <div className="participant-info">
                    <span className="avatar-letter">
                      {(p.name || 'P').trim()[0].toUpperCase()}
                    </span>
                    <div className="name-meta">
                      <strong className="participant-name">{p.name}</strong>
                      <span className="payment-status-tag">
                        {isPaid ? '✓ Paid' : '⏳ Payment Pending'}
                      </span>
                    </div>
                  </div>

                  <div className="participant-right">
                    <strong className="participant-amount">
                      ₹{Number(p.amount || 0).toLocaleString('en-IN')}
                    </strong>

                    {isPaid ? (
                      <span className="paid-confirmed-badge">
                        PAID ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="mark-paid-button"
                        onClick={() => handleMarkPaidClick(p, idx)}
                        disabled={isUpdating}
                        title={`Mark ${p.name}'s share as paid`}
                      >
                        Mark Paid ✓
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="split-modal-bottom">
          <button
            type="button"
            className="text-button delete-split-link"
            onClick={handleDelete}
          >
            🗑 Delete Bill
          </button>
          <button
            type="button"
            className="secondary-button close-details-btn"
            onClick={closeModal}
          >
            Close
          </button>
        </div>
      </div>
    </ModalShell>
  )
}
