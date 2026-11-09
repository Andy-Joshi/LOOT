import React, { useState, useEffect, useId, useMemo } from 'react'
import AnimatedNumber from './AnimatedNumber'
import './WeeklyBillModal.css'

/**
 * Format date string into human readable day label
 */
function formatDayLabel(dateStr) {
  if (!dateStr) return 'Recent'
  try {
    const parts = dateStr.split('-')
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10)
      const month = parseInt(parts[1], 10) - 1
      const day = parseInt(parts[2], 10)
      const d = new Date(year, month, day)
      return d.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })
    }
  } catch {
    // fallback
  }
  return dateStr
}

/**
 * WeeklyBillModal Component
 *
 * Modern 560px modal (full-width bottom-sheet on mobile) showing a 7-day
 * financial bill summary with staggered animations, animated numbers,
 * dynamic net flow indicator, animated category bars, full daily transactions
 * list for the week (with today's transactions prominently highlighted),
 * and an authentic receipt empty state.
 *
 * @param {Object} props
 * @param {Object} props.bill - Weekly bill summary data
 * @param {Function} props.onClose - Modal close handler
 * @param {Function} props.onAddSpend - Handler to open expense modal
 */
export default function WeeklyBillModal({ bill, onClose, onAddSpend }) {
  const [mounted, setMounted] = useState(false)
  const rawId = useId()
  const p = `wbm-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-`

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const safeBill = bill || {
    credits: 0,
    debits: 0,
    net: 0,
    transactions: [],
    categories: [],
    topCategory: '—'
  }

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const yesterdayStr = useMemo(() => {
    const y = new Date()
    y.setDate(y.getDate() - 1)
    return y.toISOString().slice(0, 10)
  }, [])

  // Group transactions of the week by day
  const dailyGroups = useMemo(() => {
    if (!safeBill.transactions || safeBill.transactions.length === 0) return []
    const groupsMap = {}
    safeBill.transactions.forEach(tx => {
      const dStr = tx.date || todayStr
      if (!groupsMap[dStr]) {
        groupsMap[dStr] = {
          dateStr: dStr,
          isToday: dStr === todayStr,
          isYesterday: dStr === yesterdayStr,
          transactions: [],
          daySpent: 0,
          dayIncome: 0
        }
      }
      groupsMap[dStr].transactions.push(tx)
      if (Number(tx.amount) < 0) {
        groupsMap[dStr].daySpent += Math.abs(Number(tx.amount))
      } else {
        groupsMap[dStr].dayIncome += Number(tx.amount)
      }
    })

    return Object.values(groupsMap).sort((a, b) => b.dateStr.localeCompare(a.dateStr))
  }, [safeBill.transactions, todayStr, yesterdayStr])

  const hasData = safeBill.transactions.length > 0 || safeBill.credits > 0 || safeBill.debits > 0
  const maxCategory = safeBill.categories.length > 0
    ? Math.max(1, ...safeBill.categories.map(([, amount]) => amount))
    : 1

  return (
    <div className="wbm-container" role="dialog" aria-modal="true" aria-labelledby="wbm-title">
      {/* 1. Clear Header (Stagger 1) */}
      <div className="wbm-header wbm-stagger-1">
        <div className="wbm-header-titles">
          <div className="wbm-eyebrow">
            <span className="wbm-kicker">WEEKLY MONEY BILL</span>
            <span className="wbm-period-pill">LAST 7 DAYS</span>
          </div>
          <h2 id="wbm-title">Your 7-Day Money Flow</h2>
          <p className="wbm-subtitle">Summary of income, expenses, and weekly money habits.</p>
        </div>
        <button
          className="wbm-close-btn"
          onClick={onClose}
          aria-label="Close Weekly Bill"
        >
          ✕
        </button>
      </div>

      {/* 2. 3-Stat Row: Credits, Debits, Net flow (Stagger 2) */}
      <div className="wbm-stat-row wbm-stagger-2">
        {/* Credits */}
        <div className="wbm-stat-card credits">
          <span className="wbm-stat-label">CREDITS</span>
          <div className="wbm-stat-val credit-text">
            <span>+₹</span>
            <strong>
              <AnimatedNumber value={safeBill.credits} formatIndian={true} />
            </strong>
          </div>
          <span className="wbm-stat-sub">money in</span>
        </div>

        {/* Debits */}
        <div className="wbm-stat-card debits">
          <span className="wbm-stat-label">DEBITS</span>
          <div className="wbm-stat-val debit-text">
            <span>-₹</span>
            <strong>
              <AnimatedNumber value={safeBill.debits} formatIndian={true} />
            </strong>
          </div>
          <span className="wbm-stat-sub">money out</span>
        </div>

        {/* Net Flow */}
        <div className={`wbm-stat-card net-flow ${safeBill.net >= 0 ? 'positive' : 'negative'}`}>
          <div className="wbm-stat-label-wrap">
            <span className="wbm-stat-label">NET FLOW</span>
            <span className={`wbm-flow-arrow ${safeBill.net >= 0 ? 'arrow-up' : 'arrow-down'}`}>
              {safeBill.net >= 0 ? '↑' : '↓'}
            </span>
          </div>
          <div className={`wbm-stat-val ${safeBill.net >= 0 ? 'credit-text' : 'debit-text'}`}>
            <span>{safeBill.net >= 0 ? '+₹' : '-₹'}</span>
            <strong>
              <AnimatedNumber value={Math.abs(safeBill.net)} formatIndian={true} />
            </strong>
          </div>
          <span className="wbm-stat-sub">
            {safeBill.net >= 0 ? 'net saved' : 'net deficit'}
          </span>
        </div>
      </div>

      {/* 3. Top Spend Highlight (Stagger 3) */}
      <div className="wbm-highlight-wrap wbm-stagger-3">
        {safeBill.debits > 0 && safeBill.categories.length > 0 ? (
          <div className="wbm-highlight-card">
            <div className="wbm-highlight-badge">✦</div>
            <div className="wbm-highlight-content">
              <span className="wbm-highlight-kicker">TOP SPEND CATEGORY</span>
              <div className="wbm-highlight-main">
                <strong className="wbm-top-cat-name">{safeBill.topCategory}</strong>
                <span className="wbm-top-cat-amt">
                  ₹{safeBill.categories[0][1].toLocaleString('en-IN')}
                </span>
              </div>
              <p className="wbm-highlight-desc">
                Accounted for {Math.round((safeBill.categories[0][1] / safeBill.debits) * 100)}% of your weekly debits.
              </p>
            </div>
          </div>
        ) : (
          <div className="wbm-highlight-card neutral">
            <div className="wbm-highlight-badge">★</div>
            <div className="wbm-highlight-content">
              <span className="wbm-highlight-kicker">WEEKLY STATUS</span>
              <div className="wbm-highlight-main">
                <strong className="wbm-top-cat-name">Clean Ledger</strong>
                <span className="wbm-top-cat-amt">₹0 Spend</span>
              </div>
              <p className="wbm-highlight-desc">
                No debits logged in this 7-day period. Keep your streak alive!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 4. Where your money went - Categories Breakdown (Stagger 4) */}
      <div className="wbm-breakdown-section wbm-stagger-4">
        {hasData ? (
          <>
            {safeBill.categories.length > 0 && (
              <>
                <div className="wbm-section-head">
                  <h3>Where your money went</h3>
                  <span className="wbm-tx-count">
                    {safeBill.categories.length} {safeBill.categories.length === 1 ? 'category' : 'categories'}
                  </span>
                </div>

                <div className="wbm-categories-list">
                  {safeBill.categories.map(([category, amount]) => {
                    const percent = Math.round((amount / safeBill.debits) * 100) || 0
                    const barWidth = Math.min(100, Math.round((amount / maxCategory) * 100))
                    return (
                      <div className="wbm-cat-item" key={category}>
                        <div className="wbm-cat-info">
                          <span className="wbm-cat-name">{category}</span>
                          <div className="wbm-cat-nums">
                            <strong className="wbm-cat-amt">
                              ₹<AnimatedNumber value={amount} formatIndian={true} />
                            </strong>
                            <span className="wbm-cat-pct">{percent}%</span>
                          </div>
                        </div>
                        <div className="wbm-bar-track">
                          <div
                            className="wbm-bar-fill"
                            style={{ width: mounted ? `${barWidth}%` : '0%' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* 5. Daily Transactions of the Week (Stagger 5) */}
            <div className="wbm-daily-section">
              <div className="wbm-section-head">
                <div className="wbm-section-title-wrap">
                  <h3>This Week's Daily Transactions</h3>
                  <span className="wbm-section-pill">{safeBill.transactions.length} total</span>
                </div>
                <span className="wbm-tx-count">All 7-day moves</span>
              </div>

              <div className="wbm-daily-groups">
                {dailyGroups.map(group => (
                  <div className={`wbm-day-group ${group.isToday ? 'is-today' : ''}`} key={group.dateStr}>
                    <div className="wbm-day-header">
                      <div className="wbm-day-title-wrap">
                        {group.isToday ? (
                          <span className="wbm-day-badge today">TODAY</span>
                        ) : group.isYesterday ? (
                          <span className="wbm-day-badge yesterday">YESTERDAY</span>
                        ) : (
                          <span className="wbm-day-badge date">{group.dateStr}</span>
                        )}
                        <span className="wbm-day-label">{formatDayLabel(group.dateStr)}</span>
                      </div>
                      <div className="wbm-day-summary">
                        {group.daySpent > 0 && (
                          <span className="wbm-day-spent debit-text">
                            -₹{group.daySpent.toLocaleString('en-IN')}
                          </span>
                        )}
                        {group.dayIncome > 0 && (
                          <span className="wbm-day-income credit-text">
                            +₹{group.dayIncome.toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="wbm-tx-list">
                      {group.transactions.map((tx, idx) => {
                        const isCredit = Number(tx.amount) > 0
                        return (
                          <div className={`wbm-tx-item ${isCredit ? 'credit-item' : 'debit-item'}`} key={tx.id || `${group.dateStr}_${idx}`}>
                            <div className="wbm-tx-left">
                              <span className={`wbm-tx-icon ${isCredit ? 'credit-bg' : 'debit-bg'}`}>
                                {isCredit ? '↗' : '↘'}
                              </span>
                              <div className="wbm-tx-details">
                                <div className="wbm-tx-name-row">
                                  <strong className="wbm-tx-name">{tx.title}</strong>
                                  {group.isToday && (
                                    <span className="wbm-tx-today-tag">Today</span>
                                  )}
                                </div>
                                <span className="wbm-tx-category">{tx.category || (isCredit ? 'Income' : 'Spend')}</span>
                              </div>
                            </div>
                            <div className="wbm-tx-right">
                              <strong className={`wbm-tx-amount ${isCredit ? 'credit-text' : 'debit-text'}`}>
                                {isCredit ? '+₹' : '-₹'}{Math.abs(Number(tx.amount)).toLocaleString('en-IN')}
                              </strong>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Animated Receipt Empty State */
          <div className="wbm-empty-state">
            <div className="wbm-empty-art">
              <svg
                viewBox="70 70 260 320"
                width="110"
                height="135"
                role="img"
                aria-label="Empty receipt art"
              >
                <defs>
                  <linearGradient id={`${p}rg`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#142c16" />
                    <stop offset="100%" stopColor="#08150a" />
                  </linearGradient>
                  <linearGradient id={`${p}cg`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#67ff3a" />
                    <stop offset="100%" stopColor="#8a4dff" />
                  </linearGradient>
                  <filter id={`${p}glow`}>
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Receipt Card */}
                <rect
                  x="95"
                  y="85"
                  width="210"
                  height="275"
                  rx="14"
                  fill={`url(#${p}rg)`}
                  stroke="#67ff3a"
                  strokeWidth="2.5"
                  strokeDasharray="6 4"
                  filter={`url(#${p}glow)`}
                />

                {/* Header bars */}
                <rect x="120" y="110" width="160" height="10" rx="5" fill="#67ff3a" opacity="0.4" />
                <rect x="145" y="128" width="110" height="6" rx="3" fill="#a4b8a6" opacity="0.3" />

                {/* Center Coin Badge */}
                <circle cx="200" cy="210" r="42" fill="#0b170c" stroke={`url(#${p}cg)`} strokeWidth="3" />
                <path
                  d="M185 210 L195 220 L218 196"
                  fill="none"
                  stroke="#67ff3a"
                  strokeWidth="4.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Barcode lines */}
                <g opacity="0.45" transform="translate(125, 290)">
                  <rect x="0" y="0" width="4" height="20" fill="#67ff3a" />
                  <rect x="8" y="0" width="7" height="20" fill="#67ff3a" />
                  <rect x="19" y="0" width="3" height="20" fill="#67ff3a" />
                  <rect x="26" y="0" width="9" height="20" fill="#67ff3a" />
                  <rect x="40" y="0" width="5" height="20" fill="#67ff3a" />
                  <rect x="50" y="0" width="6" height="20" fill="#67ff3a" />
                  <rect x="62" y="0" width="4" height="20" fill="#67ff3a" />
                  <rect x="72" y="0" width="8" height="20" fill="#67ff3a" />
                  <rect x="86" y="0" width="5" height="20" fill="#67ff3a" />
                  <rect x="98" y="0" width="7" height="20" fill="#67ff3a" />
                  <rect x="112" y="0" width="4" height="20" fill="#67ff3a" />
                  <rect x="122" y="0" width="8" height="20" fill="#67ff3a" />
                  <rect x="136" y="0" width="5" height="20" fill="#67ff3a" />
                </g>
              </svg>
            </div>

            <h4>No transactions this week</h4>
            <p>
              Log your first spend or weekly pocket money to see your interactive 7-day spending breakdown, daily ledger, and category insights.
            </p>

            <button
              type="button"
              className="primary-button wbm-empty-action"
              onClick={() => {
                onClose()
                if (onAddSpend) onAddSpend()
              }}
            >
              ＋ Log spend (+2 ✦)
            </button>
          </div>
        )}
      </div>

      {/* 6. Primary Done Button */}
      <div className="wbm-footer">
        <button
          type="button"
          className="primary-button wbm-done-button"
          onClick={onClose}
        >
          Done
        </button>
      </div>
    </div>
  )
}
