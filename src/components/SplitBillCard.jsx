import React from 'react'
import AnimatedNumber from './AnimatedNumber'
import { calculateSplitProgress } from '../services/splitService'
import './SplitBillCard.css'

/**
 * SplitBillCard Component (Split Bills 2.0)
 *
 * Polished, compact split bill card for Money Lab featuring:
 * - Bill title & total amount
 * - Splitting method (Equal Split vs Custom Split)
 * - Settlement status (Pending, Partially Settled, Fully Settled)
 * - Amount settled vs outstanding amount
 * - Interactive settlement progress bar
 * - Clickable to open full settlement details modal
 *
 * @param {Object} props
 * @param {Object} props.split - Split bill object
 * @param {Function} props.onOpenDetails - Click handler to open settlement details
 */
export default function SplitBillCard({ split, onOpenDetails }) {
  if (!split) return null

  const progress = calculateSplitProgress(split)
  const participants = Array.isArray(split.participants) ? split.participants : []

  return (
    <div
      className={`feature-card card split-bill-card ${progress.isFullySettled ? 'settled-card' : ''}`}
      onClick={() => onOpenDetails && onOpenDetails(split)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          if (onOpenDetails) onOpenDetails(split)
        }
      }}
      title="Click to view settlement details"
    >
      {/* Top Header Row: Status Badge & Mode Tag */}
      <div className="split-card-top">
        <span className={`split-status-tag ${progress.statusKey}`}>
          {progress.status}
        </span>
        <span className="split-method-tag">
          {split.mode === 'custom' ? 'Custom Split' : 'Equal Split'}
        </span>
      </div>

      {/* Title & Total */}
      <h3 className="split-card-title">{split.title}</h3>
      <strong className="split-card-total">
        ₹<AnimatedNumber value={split.total} formatIndian />
      </strong>

      {/* Progress Bar */}
      <div className="split-card-progress-wrap">
        <div
          className={`split-card-progress-bar ${progress.isFullySettled ? 'fully-settled' : ''}`}
          style={{ width: `${progress.progressPercent}%` }}
        />
      </div>

      {/* Settlement Amounts Row */}
      <div className="split-card-amounts-row">
        <span className="amt-settled">
          ₹{progress.settledAmount.toLocaleString('en-IN')} settled
        </span>
        <span className="amt-remaining">
          {progress.isFullySettled ? '✓ Cleared' : `₹${progress.remainingAmount.toLocaleString('en-IN')} left`}
        </span>
      </div>

      {/* Participants Preview Pills */}
      <div className="split-card-participants">
        {participants.slice(0, 3).map((p, idx) => (
          <span
            key={p.id || `${p.name}-${idx}`}
            className={`p-pill ${p.paid ? 'paid' : 'pending'}`}
          >
            {p.name} {p.paid ? '✓' : ''}
          </span>
        ))}
        {participants.length > 3 && (
          <span className="p-pill more">+{participants.length - 3}</span>
        )}
      </div>

      {/* Card Action Hint */}
      <div className="split-card-action-hint">
        <span>{progress.paidCount}/{progress.totalCount} paid · Manage settlement →</span>
      </div>
    </div>
  )
}
