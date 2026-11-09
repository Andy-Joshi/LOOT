import React, { useState, useMemo } from 'react'
import AnimatedNumber from './AnimatedNumber'
import {
  settleShortfallManually,
  recordBorrowedLoan
} from '../services/moneyEngine'
import { playCelebrationSound, playCoinSound } from '../utils/sfx'
import './ShortfallsSection.css'

export default function ShortfallsSection({
  accountingState = {},
  notify
}) {
  const [filter, setFilter] = useState('all') // 'all' | 'outstanding' | 'settled' | 'loan'
  const [sort, setSort] = useState('newest') // 'newest' | 'highest' | 'remaining'
  const [settlingItem, setSettlingItem] = useState(null)
  const [settleAmount, setSettleAmount] = useState('')
  const [settleSource, setSettleSource] = useState('available_cash')
  const [showLoanModal, setShowLoanModal] = useState(false)
  const [loanForm, setLoanForm] = useState({ lender: '', amount: '', purpose: '' })
  const [expandedHistories, setExpandedHistories] = useState({})

  const shortfalls = accountingState.shortfalls
  const availableBalance = accountingState.availableBalance || 0
  const outstandingTotal = accountingState.outstandingShortfall || 0

  // Filter
  const filteredList = useMemo(() => {
    let list = [...(shortfalls || [])]

    if (filter === 'outstanding') {
      list = list.filter(sf => sf.status !== 'settled')
    } else if (filter === 'settled') {
      list = list.filter(sf => sf.status === 'settled')
    } else if (filter === 'loan') {
      list = list.filter(sf => sf.type === 'loan')
    }

    if (sort === 'newest') {
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    } else if (sort === 'highest') {
      list.sort((a, b) => b.originalAmount - a.originalAmount)
    } else if (sort === 'remaining') {
      list.sort((a, b) => b.remainingAmount - a.remainingAmount)
    }

    return list
  }, [shortfalls, filter, sort])

  const toggleHistory = (id) => {
    setExpandedHistories(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Handle Manual Settlement Submit
  const handleSettleSubmit = async (e) => {
    e.preventDefault()
    if (!settlingItem) return

    const amt = Number(settleAmount)
    if (!amt || amt <= 0) {
      if (notify) notify('Please enter a valid settlement amount.')
      return
    }

    try {
      await settleShortfallManually(settlingItem.id, amt, settleSource)
      playCelebrationSound()
      playCoinSound()
      if (notify) notify(`Settled ₹${amt.toLocaleString('en-IN')} towards "${settlingItem.title}"!`)
      setSettlingItem(null)
      setSettleAmount('')
    } catch (err) {
      if (notify) notify(err.message || 'Settlement failed.')
    }
  }

  // Handle New Genuine Loan Submit
  const handleLoanSubmit = async (e) => {
    e.preventDefault()
    if (!loanForm.lender.trim()) {
      if (notify) notify('Please provide an explicit lender name.')
      return
    }
    const amt = Number(loanForm.amount)
    if (!amt || amt <= 0) {
      if (notify) notify('Please enter a valid loan amount.')
      return
    }

    try {
      await recordBorrowedLoan({
        lender: loanForm.lender.trim(),
        amount: amt,
        purpose: loanForm.purpose.trim() || 'Borrowed money'
      })
      playCoinSound()
      if (notify) notify(`Recorded loan of ₹${amt.toLocaleString('en-IN')} from ${loanForm.lender}!`)
      setShowLoanModal(false)
      setLoanForm({ lender: '', amount: '', purpose: '' })
    } catch (err) {
      if (notify) notify(err.message || 'Failed to record loan.')
    }
  }

  return (
    <div className="shortfalls-section-container">
      {/* 1. Header */}
      <div className="shortfalls-head">
        <div>
          <span className="section-kicker">SHORTFALLS & BORROWED MONEY</span>
          <h2>Debt Obligations & Deficits</h2>
          <p className="shortfalls-subhead">
            Track unbacked expense overdrafts and genuine borrowed loans. All incoming funds settle debts automatically first.
          </p>
        </div>

        <div className="shortfalls-head-actions">
          <button
            type="button"
            className="secondary-button add-loan-btn"
            onClick={() => setShowLoanModal(true)}
          >
            ＋ Record Genuine Loan
          </button>
          <div className="shortfalls-summary-pill">
            <span className="summary-pill-label">TOTAL OUTSTANDING</span>
            <strong className={`summary-pill-val ${outstandingTotal > 0 ? 'alert' : 'lime'}`}>
              ₹<AnimatedNumber value={outstandingTotal} formatIndian={true} />
            </strong>
          </div>
        </div>
      </div>

      {/* 2. Filter & Sort Bar */}
      <div className="shortfalls-toolbar">
        <div className="shortfalls-filters" role="tablist">
          {[
            ['all', 'All Records'],
            ['outstanding', 'Outstanding'],
            ['settled', 'Settled'],
            ['loan', 'Genuine Loans']
          ].map(([key, label]) => (
            <button
              key={key}
              className={`shortfalls-tab ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
              role="tab"
              aria-selected={filter === key}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="shortfalls-sorter">
          <label htmlFor="sf-sort-select">Sort by:</label>
          <select
            id="sf-sort-select"
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="shortfalls-select"
          >
            <option value="newest">Newest first</option>
            <option value="highest">Highest original</option>
            <option value="remaining">Highest deficit</option>
          </select>
        </div>
      </div>

      {/* 3. Shortfalls Cards List */}
      <div className="shortfalls-list">
        {filteredList.length > 0 ? (
          filteredList.map(item => {
            const isFullySettled = item.status === 'settled' || item.remainingAmount <= 0
            const progress = item.originalAmount > 0
              ? Math.min(100, Math.round((item.settledAmount / item.originalAmount) * 100))
              : 100
            const isHistoryOpen = Boolean(expandedHistories[item.id])

            return (
              <div
                key={item.id}
                className={`card shortfall-item-card ${isFullySettled ? 'settled-card' : 'active-card'} ${item.type === 'loan' ? 'is-loan-type' : ''}`}
              >
                {/* Top Row: Title, Badges */}
                <div className="shortfall-item-head">
                  <div className="shortfall-title-group">
                    <span className="item-type-icon">
                      {item.type === 'loan' ? '🤝' : '⚠️'}
                    </span>
                    <div>
                      <div className="shortfall-badge-strip">
                        <span className={`type-tag ${item.type === 'loan' ? 'loan-tag' : 'overspend-tag'}`}>
                          {item.type === 'loan' ? 'GENUINE LOAN' : 'OVERDRAFT SHORTFALL'}
                        </span>
                        <span className={`status-tag ${isFullySettled ? 'settled' : 'outstanding'}`}>
                          {isFullySettled ? '✓ SETTLED' : 'OUTSTANDING'}
                        </span>
                      </div>
                      <h4 className="item-title">{item.title}</h4>
                      {item.lender && (
                        <p className="lender-text">
                          Recorded Creditor: <b>{item.lender}</b> (Genuine borrowed money)
                        </p>
                      )}
                      <small className="item-date">Date logged: {item.date}</small>
                    </div>
                  </div>

                  <div className="shortfall-item-amounts">
                    <div className="amount-stat">
                      <span className="amount-label">Remaining:</span>
                      <strong className={`remaining-num ${isFullySettled ? 'settled' : 'alert'}`}>
                        ₹<AnimatedNumber value={item.remainingAmount} formatIndian={true} />
                      </strong>
                    </div>
                    <span className="original-sub">
                      of ₹{item.originalAmount.toLocaleString('en-IN')} original
                    </span>
                  </div>
                </div>

                {/* Progress Track */}
                <div className="shortfall-item-progress">
                  <div className="progress-track-bg">
                    <div className="progress-fill-bar" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="progress-stats-row">
                    <span>{progress}% paid off</span>
                    <span>₹{item.settledAmount.toLocaleString('en-IN')} settled</span>
                  </div>
                </div>

                {/* Card Actions & Settlement History Toggle */}
                <div className="shortfall-item-footer">
                  <button
                    type="button"
                    className="history-toggle-btn"
                    onClick={() => toggleHistory(item.id)}
                  >
                    {isHistoryOpen ? 'Hide Settlement History ▴' : `View Settlements (${item.settlements?.length || 0}) ▾`}
                  </button>

                  {!isFullySettled && (
                    <button
                      type="button"
                      className="primary-button settle-now-btn"
                      onClick={() => {
                        setSettlingItem(item)
                        setSettleAmount(String(item.remainingAmount))
                      }}
                    >
                      Settle Shortfall →
                    </button>
                  )}
                </div>

                {/* Expandable Settlement History */}
                {isHistoryOpen && (
                  <div className="settlement-history-drawer">
                    <span className="history-kicker">SETTLEMENT AUDIT TRAIL</span>
                    {item.settlements && item.settlements.length > 0 ? (
                      <div className="history-entries">
                        {item.settlements.map(st => (
                          <div key={st.id} className="history-entry-row">
                            <span className="entry-icon">✓</span>
                            <div className="entry-info">
                              <strong>₹{st.amount.toLocaleString('en-IN')} paid</strong>
                              <small>{st.date} · {st.note || st.paymentSource}</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="no-history-text">No settlements recorded yet for this shortfall.</p>
                    )}
                  </div>
                )}
              </div>
            )
          })
        ) : (
          <div className="shortfalls-empty-state">
            <span className="empty-shield">🛡️</span>
            <h4>No Shortfalls Found</h4>
            <p>You have no debt obligations matching your current filter. Your wallet is in pristine balance!</p>
          </div>
        )}
      </div>

      {/* Manual Settlement Modal */}
      {settlingItem && (
        <div className="settle-modal-overlay" role="dialog" aria-modal="true">
          <div className="settle-modal-card">
            <div className="settle-modal-head">
              <h3>Settle Shortfall</h3>
              <button
                type="button"
                className="close-x"
                onClick={() => setSettlingItem(null)}
              >
                ✕
              </button>
            </div>

            <p className="settle-modal-desc">
              Settling <b>{settlingItem.title}</b>. Outstanding remaining is <b>₹{settlingItem.remainingAmount.toLocaleString('en-IN')}</b>.
            </p>

            <form onSubmit={handleSettleSubmit} className="settle-modal-form">
              <label>
                Settlement Amount (₹)
                <input
                  type="number"
                  min="0.01"
                  max={settlingItem.remainingAmount}
                  step="any"
                  autoFocus
                  required
                  value={settleAmount}
                  onChange={e => setSettleAmount(e.target.value)}
                  className="cpm-input"
                  placeholder="₹ 0.00"
                />
              </label>

              <label>
                Payment Source
                <select
                  value={settleSource}
                  onChange={e => setSettleSource(e.target.value)}
                  className="cpm-input"
                >
                  <option value="available_cash">
                    LOOT Available Cash (Available: ₹{availableBalance.toLocaleString('en-IN')})
                  </option>
                  <option value="external">
                    External Settlement (Cash on hand / Direct Bank Transfer)
                  </option>
                </select>
              </label>

              <div className="settle-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setSettlingItem(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Confirm Settlement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Genuine Loan Modal */}
      {showLoanModal && (
        <div className="settle-modal-overlay" role="dialog" aria-modal="true">
          <div className="settle-modal-card">
            <div className="settle-modal-head">
              <h3>Record Borrowed Money (Loan)</h3>
              <button
                type="button"
                className="close-x"
                onClick={() => setShowLoanModal(false)}
              >
                ✕
              </button>
            </div>

            <p className="settle-modal-desc">
              Record legitimate borrowing from a parent, family member or friend with an explicit lender and repayment tracking. (Note: Never invent a person or creditor for overspending; genuine loans require a real lender name).
            </p>

            <form onSubmit={handleLoanSubmit} className="settle-modal-form">
              <label>
                Lender Name (Required)
                <input
                  type="text"
                  required
                  autoFocus
                  value={loanForm.lender}
                  onChange={e => setLoanForm({ ...loanForm, lender: e.target.value })}
                  className="cpm-input"
                  placeholder="e.g. Dad, Mom, Uncle Priya"
                />
              </label>

              <label>
                Loan Amount (₹)
                <input
                  type="number"
                  min="1"
                  required
                  value={loanForm.amount}
                  onChange={e => setLoanForm({ ...loanForm, amount: e.target.value })}
                  className="cpm-input"
                  placeholder="₹ 0"
                />
              </label>

              <label>
                Purpose / Note
                <input
                  type="text"
                  value={loanForm.purpose}
                  onChange={e => setLoanForm({ ...loanForm, purpose: e.target.value })}
                  className="cpm-input"
                  placeholder="e.g. Emergency bike repair"
                />
              </label>

              <div className="settle-modal-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setShowLoanModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button">
                  Record Borrowed Money
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
