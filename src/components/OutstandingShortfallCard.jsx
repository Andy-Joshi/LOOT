import React from 'react'
import AnimatedNumber from './AnimatedNumber'
import './OutstandingShortfallCard.css'

/**
 * OutstandingShortfallCard Component
 *
 * Prominent Dashboard Card:
 * - Shows outstanding amount, settlement progress, recent shortfall info
 * - Clear status indicator (e.g. "ACTION NEEDED" vs "100% BALANCED")
 * - View Details action (navigates to Money Lab or opens details)
 * - Positive settled state when outstanding amount is zero!
 */
export default function OutstandingShortfallCard({
  outstandingShortfall = 0,
  totalShortfallOriginal = 0,
  totalShortfallSettled = 0,
  recentShortfall = null,
  onViewDetails
}) {
  const isSettled = outstandingShortfall <= 0
  const progressPercent = totalShortfallOriginal > 0
    ? Math.min(100, Math.round((totalShortfallSettled / totalShortfallOriginal) * 100))
    : 100

  return (
    <div className={`card shortfall-dashboard-card ${isSettled ? 'state-settled' : 'state-active-debt'}`}>
      <div className="shortfall-card-head">
        <div>
          <span className="shortfall-card-kicker">MONEY ENGINE</span>
          <h3 className="shortfall-card-title">Outstanding Shortfall</h3>
        </div>

        <span className={`shortfall-status-pill ${isSettled ? 'settled-pill' : 'alert-pill'}`}>
          <span className="status-dot" />
          {isSettled ? '100% BALANCED' : 'ACTION NEEDED'}
        </span>
      </div>

      {isSettled ? (
        /* Positive Settled State */
        <div className="shortfall-settled-body">
          <div className="settled-icon-wrap">
            <span className="settled-shield">🛡️</span>
          </div>
          <div className="settled-text-content">
            <strong className="settled-headline">All Balanced & Cleared</strong>
            <p className="settled-desc">
              You have ₹0 in outstanding shortfalls. All expenses are backed by available funds!
            </p>
          </div>
          <button
            type="button"
            className="shortfall-details-link"
            onClick={onViewDetails}
          >
            Ledger & History →
          </button>
        </div>
      ) : (
        /* Active Outstanding Shortfall State */
        <div className="shortfall-active-body">
          <div className="shortfall-amount-row">
            <div className="shortfall-main-num">
              <span className="shortfall-currency">₹</span>
              <strong className="shortfall-val">
                <AnimatedNumber value={outstandingShortfall} formatIndian={true} />
              </strong>
            </div>
            <span className="shortfall-due-tag">Deficit to settle</span>
          </div>

          {/* Settlement Progress Track */}
          <div className="shortfall-progress-section">
            <div className="shortfall-progress-labels">
              <span>Settlement Progress</span>
              <strong className="progress-ratio">
                ₹{totalShortfallSettled.toLocaleString('en-IN')} / ₹{totalShortfallOriginal.toLocaleString('en-IN')} ({progressPercent}%)
              </strong>
            </div>
            <div className="shortfall-track">
              <div
                className="shortfall-track-fill"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Recent Shortfall Context */}
          {recentShortfall && (
            <div className="recent-shortfall-strip">
              <span className="recent-sf-icon">
                {recentShortfall.type === 'loan' ? '🤝' : '↘'}
              </span>
              <div className="recent-sf-info">
                <strong>{recentShortfall.title}</strong>
                <small>
                  ₹{recentShortfall.originalAmount.toLocaleString('en-IN')} logged on {recentShortfall.date}
                  {recentShortfall.lender ? ` · Lender: ${recentShortfall.lender}` : ''}
                </small>
              </div>
            </div>
          )}

          <div className="shortfall-footer-action">
            <p className="shortfall-auto-hint">
              Incoming money automatically settles this shortfall first.
            </p>
            <button
              type="button"
              className="primary-button shortfall-view-btn"
              onClick={onViewDetails}
            >
              View Details & Settle →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
