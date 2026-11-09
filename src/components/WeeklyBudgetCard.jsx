import React, { useState } from 'react'
import AnimatedNumber from './AnimatedNumber'
import './WeeklyBudgetCard.css'

const PRESET_BUDGETS = [1000, 2000, 3000, 5000]

/**
 * WeeklyBudgetCard Component
 *
 * Prominent dashboard section displaying:
 * - "LEFT THIS WEEK" large animated amount
 * - Weekly budget, Spent, and Progress metrics
 * - Overspending detection and clear alert state (never shows negative remaining as available money)
 * - Interactive configuration prompt when no budget is set
 * - Inline budget adjustment controls
 *
 * @param {Object} props
 * @param {Object} props.budgetStats - Budget statistics from budgetService
 * @param {Function} props.onSetBudget - Callback to save a new weekly budget
 * @param {Function} props.onLogSpend - Callback to open expense modal
 */
export default function WeeklyBudgetCard({
  budgetStats = {},
  onSetBudget,
  onLogSpend
}) {
  const {
    hasBudget = false,
    weeklyBudget = 0,
    spent = 0,
    remaining = 0,
    isOverBudget = false,
    overspentAmount = 0,
    progressPercent = 0,
    txCount = 0,
    daysRemaining = 7
  } = budgetStats

  const [isEditing, setIsEditing] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handleStartEdit = () => {
    setBudgetInput(weeklyBudget > 0 ? String(weeklyBudget) : '2000')
    setErrorMsg('')
    setIsEditing(true)
  }

  const handleSaveBudget = (amountToSave) => {
    const val = amountToSave !== undefined ? amountToSave : Number(budgetInput)
    if (isNaN(val) || val <= 0) {
      setErrorMsg('Please enter a valid weekly budget amount.')
      return
    }
    if (onSetBudget) {
      onSetBudget(Math.round(val))
    }
    setIsEditing(false)
    setErrorMsg('')
  }

  // Visual status color
  const statusColor = isOverBudget
    ? '#ff4d6d'
    : progressPercent >= 80
      ? '#ffbe3b'
      : '#67ff3a'

  return (
    <section
      className={`card weekly-budget-card ${isOverBudget ? 'overspent-card' : ''} ${!hasBudget ? 'unconfigured-card' : ''}`}
      aria-label="Weekly Remaining Budget Section"
    >
      {/* 1. UNCONFIGURED STATE */}
      {!hasBudget ? (
        <div className="budget-prompt-state">
          <div className="budget-card-header">
            <div>
              <span className="section-kicker">✦ WEEKLY BUDGET · CADENCE</span>
              <h3>Set Your Weekly Budget</h3>
            </div>
            <span className="budget-status-pill unconfigured">⚠️ NOT SET</span>
          </div>

          <p className="budget-prompt-desc">
            Track how much money you have left to spend each week. Pick a quick preset or enter your custom weekly allowance:
          </p>

          <div className="budget-preset-row">
            {PRESET_BUDGETS.map(amount => (
              <button
                key={amount}
                type="button"
                className="budget-preset-chip"
                onClick={() => handleSaveBudget(amount)}
              >
                ₹{amount.toLocaleString('en-IN')}
              </button>
            ))}
          </div>

          <div className="budget-custom-form">
            <span className="budget-input-prefix">₹</span>
            <input
              type="number"
              min="100"
              max="1000000"
              placeholder="Enter custom weekly budget"
              className="budget-input-field"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveBudget()
              }}
            />
            <button
              type="button"
              className="primary-button budget-set-btn"
              onClick={() => handleSaveBudget()}
            >
              Set Budget
            </button>
          </div>
          {errorMsg && <p className="budget-error-msg">{errorMsg}</p>}
        </div>
      ) : (
        /* 2. CONFIGURED BUDGET STATE */
        <div className="budget-configured-state">
          {/* Top Bar: Title & Edit Button */}
          <div className="budget-card-header">
            <div>
              <span className="section-kicker">WEEKLY BUDGET</span>
              <h2 className="budget-section-heading">LEFT THIS WEEK</h2>
            </div>

            <div className="budget-header-actions">
              {isOverBudget ? (
                <span className="budget-status-pill alert">
                  ⚠️ Over budget by ₹{overspentAmount.toLocaleString('en-IN')}
                </span>
              ) : remaining === 0 ? (
                <span className="budget-status-pill warning">
                  100% Spent
                </span>
              ) : (
                <span className="budget-status-pill active">
                  {Math.max(0, 100 - progressPercent)}% Available
                </span>
              )}

              <button
                type="button"
                className="budget-edit-pill-btn"
                onClick={handleStartEdit}
                title="Click to change weekly budget"
              >
                ₹{weeklyBudget.toLocaleString('en-IN')} BUDGET ✎
              </button>
            </div>
          </div>

          {/* Inline Edit Form Drawer */}
          {isEditing && (
            <div className="budget-inline-edit-panel">
              <span className="edit-kicker">ADJUST WEEKLY BUDGET:</span>
              <div className="budget-preset-row mini">
                {PRESET_BUDGETS.map(amount => (
                  <button
                    key={amount}
                    type="button"
                    className={`budget-preset-chip ${Number(budgetInput) === amount ? 'selected' : ''}`}
                    onClick={() => setBudgetInput(String(amount))}
                  >
                    ₹{amount.toLocaleString('en-IN')}
                  </button>
                ))}
              </div>
              <div className="budget-custom-form inline">
                <span className="budget-input-prefix">₹</span>
                <input
                  type="number"
                  min="100"
                  className="budget-input-field"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveBudget()
                    if (e.key === 'Escape') setIsEditing(false)
                  }}
                  autoFocus
                />
                <button type="button" className="primary-button btn-sm" onClick={() => handleSaveBudget()}>
                  Save
                </button>
                <button type="button" className="secondary-button btn-sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Primary Metric: Big Hero Display */}
          <div className="budget-hero-display">
            {!isOverBudget ? (
              <div className="budget-remaining-wrap">
                <span className="currency-symbol">₹</span>
                <strong className="remaining-number">
                  <AnimatedNumber value={remaining} formatIndian={true} />
                </strong>
                <span className="remaining-sublabel">left</span>
              </div>
            ) : (
              <div className="budget-remaining-wrap overspent">
                <span className="currency-symbol overspent">₹</span>
                <strong className="remaining-number overspent">
                  <AnimatedNumber value={overspentAmount} formatIndian={true} />
                </strong>
                <span className="remaining-sublabel overspent">over budget</span>
              </div>
            )}
          </div>

          {/* Overspent Clarification Note: never display negative remaining as available money */}
          {isOverBudget && (
            <div className="overspent-banner">
              <span>⚠️ Budget exceeded: ₹0 left available for this cycle.</span>
            </div>
          )}

          {/* Context Metrics Bar: Weekly Budget, Spent, Progress */}
          <div className="budget-context-grid">
            <div className="budget-context-item">
              <span className="context-label">Weekly budget</span>
              <strong className="context-value">
                ₹{weeklyBudget.toLocaleString('en-IN')}
              </strong>
            </div>

            <div className="budget-context-item">
              <span className="context-label">Spent</span>
              <strong className="context-value">
                ₹{spent.toLocaleString('en-IN')}
              </strong>
            </div>

            <div className="budget-context-item">
              <span className="context-label">Progress</span>
              <strong className="context-value" style={{ color: statusColor }}>
                {progressPercent}%
              </strong>
            </div>
          </div>

          {/* Visual Progress Bar */}
          <div className="budget-progress-container">
            <div className="budget-progress-track">
              <div
                className="budget-progress-fill"
                style={{
                  width: `${Math.min(100, progressPercent)}%`,
                  background: statusColor,
                  boxShadow: `0 0 12px ${statusColor}`
                }}
              />
            </div>
          </div>

          {/* Footer: Days Remaining & Quick Action */}
          <div className="budget-card-footer">
            <span className="budget-cycle-note">
              ✦ {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left in budget week · {txCount} {txCount === 1 ? 'spend' : 'spends'} logged
            </span>
            {onLogSpend && (
              <button
                type="button"
                className="budget-log-btn"
                onClick={onLogSpend}
              >
                ＋ Log spend (+2 ✦)
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
