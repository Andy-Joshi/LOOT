import React, { useState, useEffect } from 'react'
import './SpendingImpactModal.css'

/**
 * SpendingImpactModal Component
 *
 * Displays the immediate financial impact of a recorded expense on active savings goals.
 * Shows:
 * - Clear delay indicator (+X DAYS / +X WEEKS) with subtle animation
 * - Affected goal name and category
 * - Explanatory trajectory delay statement
 * - Trajectory comparison (Before vs After completion dates)
 * - Multi-goal selector if multiple goals are affected
 * - Neutral confirmation if the expense does not delay any goals
 * - "View Affected Goal" CTA to seamlessly inspect the goal card
 */
export default function SpendingImpactModal({
  impact,
  onClose,
  onViewGoal
}) {
  const [selectedGoalId, setSelectedGoalId] = useState(null)

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!impact) return null

  const hasImpact = Boolean(impact.hasImpact)
  const primaryImpact = impact.primaryImpact

  // For multi-goal selector
  const allAffected = hasImpact
    ? [primaryImpact, ...(impact.otherAffected || [])]
    : []

  const activeSelectedId = selectedGoalId !== null ? selectedGoalId : primaryImpact?.goalId
  const currentImpact = allAffected.find(g => String(g.goalId) === String(activeSelectedId)) || primaryImpact

  const handleViewGoal = () => {
    if (onViewGoal && currentImpact?.goalId) {
      onViewGoal(currentImpact.goalId)
    }
    if (onClose) onClose()
  }

  return (
    <div className="impact-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="impact-modal-card"
        onClick={e => e.stopPropagation()}
        aria-label="Spending Impact on Savings Goals"
      >
        <button
          className="impact-modal-close"
          onClick={onClose}
          aria-label="Close spending impact"
        >
          ×
        </button>

        {hasImpact && currentImpact ? (
          <>
            {/* Kicker & Title */}
            <div className="impact-header">
              <span className="impact-kicker">SPENDING IMPACT · Q2</span>
              <h2 className="impact-title">Your purchase has an impact!</h2>
              <div className="impact-expense-pill">
                <span>{impact.expenseTitle || 'Expense'}</span>
                <span>•</span>
                <strong>₹{Number(impact.expenseAmount || 0).toLocaleString('en-IN')}</strong>
                {impact.expenseCategory && (
                  <>
                    <span>•</span>
                    <span className="impact-category-tag">{impact.expenseCategory}</span>
                  </>
                )}
              </div>
            </div>

            {/* Prominent Impact Badge */}
            <div className="impact-badge-wrap">
              <div className="impact-badge" title="Estimated Goal Delay">
                <span className="impact-badge-arrow">⏳</span>
                <span className="impact-badge-text">{currentImpact.badgeText || `+${currentImpact.delayDays} DAYS`}</span>
              </div>
              <span className="impact-badge-sub">Goal completion delayed</span>
            </div>

            {/* Affected Goal Preview Card */}
            <div className="impact-goal-box">
              <div className="impact-goal-head">
                <div className={`impact-goal-icon ${currentImpact.goalColor || 'lime'}`}>
                  {currentImpact.goalIcon || '◎'}
                </div>
                <div className="impact-goal-info">
                  <span className="impact-goal-category">{currentImpact.goalCategory || 'Mission'}</span>
                  <h3 className="impact-goal-name">{currentImpact.goalName} Goal</h3>
                </div>
              </div>

              <p className="impact-message">
                "{currentImpact.message || `This expense pushes your ${currentImpact.goalName} goal back by ${currentImpact.delayDays} days.`}"
              </p>

              {/* Trajectory comparison grid */}
              <div className="impact-metrics-grid">
                <div className="impact-metric-item">
                  <span className="impact-metric-label">Savings Pace</span>
                  <strong className="impact-metric-val">
                    ₹{Number(currentImpact.weeklyPace || 0).toLocaleString('en-IN')}<small>/wk</small>
                  </strong>
                </div>

                <div className="impact-metric-item">
                  <span className="impact-metric-label">Original ETA</span>
                  <strong className="impact-metric-val before-date">
                    {currentImpact.beforeEtaDate || `${currentImpact.beforeDays} days`}
                  </strong>
                </div>

                <div className="impact-metric-item highlight">
                  <span className="impact-metric-label">New Expected ETA</span>
                  <strong className="impact-metric-val after-date">
                    {currentImpact.afterEtaDate || `${currentImpact.afterDays} days`}
                  </strong>
                </div>
              </div>
            </div>

            {/* Multi-goal selector if multiple goals are affected */}
            {allAffected.length > 1 && (
              <div className="impact-multi-goals">
                <span className="impact-multi-label">Other affected goals ({allAffected.length}):</span>
                <div className="impact-multi-pills">
                  {allAffected.map(item => {
                    const isSelected = String(item.goalId) === String(currentImpact.goalId)
                    return (
                      <button
                        key={item.goalId}
                        type="button"
                        className={`impact-pill-btn ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedGoalId(item.goalId)}
                      >
                        <span>{item.goalName}</span>
                        <b className="impact-pill-delay">+{item.delayDays}d</b>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="impact-actions">
              <button
                type="button"
                className="impact-primary-btn"
                onClick={handleViewGoal}
              >
                View {currentImpact.goalName} Goal →
              </button>
              <button
                type="button"
                className="impact-secondary-btn"
                onClick={onClose}
              >
                Got it
              </button>
            </div>
          </>
        ) : (
          /* Neutral Confirmation for Expenses that do not affect any goal */
          <div className="impact-neutral-view">
            <div className="impact-neutral-icon">✓</div>
            <span className="impact-kicker">SAVINGS TRAJECTORY SECURE</span>
            <h2 className="impact-title">Goals Untouched!</h2>
            <div className="impact-neutral-badge">
              <span>NO GOAL DELAY</span>
            </div>
            <p className="impact-neutral-desc">
              {impact.neutralMessage || 'This expense does not push back any of your savings goals. Your savings pace remains steady.'}
            </p>
            <button
              type="button"
              className="impact-primary-btn full"
              onClick={onClose}
            >
              Continue to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
