import React, { useState, useEffect, useMemo } from 'react'
import AnimatedNumber from './AnimatedNumber'
import {
  DEFAULT_RELATABLE_UNITS,
  calculateRelatableUnits,
  convertToUnit
} from '../services/budgetService'
import './SpendingBreakdownCard.css'

const CATEGORY_COLORS = {
  Lifestyle: '#67ff3a',
  Tech: '#8a4dff',
  Essentials: '#45d9d2',
  Food: '#ff6b92',
  Entertainment: '#f5ce53',
  Other: '#c8ff3d'
}

/**
 * SpendingBreakdownCard Component
 *
 * Provides a high-clarity animated visual breakdown of spending with:
 * 1. Two-state toggle: Rupees (₹) vs Relatable everyday units (🥟 Samosas, 🧋 Boba Teas, etc.).
 * 2. Dynamic, mathematically accurate relatable unit conversion with sensible formatting.
 * 3. Configurable unit prices with persistent local storage.
 * 4. Preservation of original currency amounts and explicit assumed item prices.
 *
 * @param {Object} props
 * @param {Array<[string, number]>} props.categories - Category entries [name, amount]
 * @param {number} props.totalSpent - Total spending amount
 * @param {number} props.txCount - Number of logged transactions
 * @param {Function} props.onAddSpend - Callback to log spend if empty
 * @param {string} [props.initialMode='rupees'] - Starting mode ('rupees' | 'relatable')
 * @param {string} [props.initialUnitId='samosas'] - Default relatable unit
 */
export default function SpendingBreakdownCard({
  categories = [],
  totalSpent = 0,
  txCount = 0,
  onAddSpend,
  initialMode = 'rupees',
  initialUnitId = 'samosas'
}) {
  const safeTotal = Math.max(1, totalSpent)
  const [mode, setMode] = useState(initialMode)
  const [selectedUnitId, setSelectedUnitId] = useState(initialUnitId)
  const [customPrices, setCustomPrices] = useState(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const saved = window.localStorage.getItem('loot_relatable_unit_prices')
        if (saved) return JSON.parse(saved)
      }
    } catch {
      // fallback
    }
    return {}
  })

  const [isEditingPrice, setIsEditingPrice] = useState(false)
  const [editPriceInput, setEditPriceInput] = useState('')

  // Sync custom prices to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('loot_relatable_unit_prices', JSON.stringify(customPrices))
      }
    } catch {
      // fallback
    }
  }, [customPrices])

  // Converted totals for all units
  const relatableOptions = useMemo(() => {
    return calculateRelatableUnits(totalSpent, customPrices)
  }, [totalSpent, customPrices])

  // Active unit conversion
  const activeUnit = useMemo(() => {
    return relatableOptions.find(u => u.id === selectedUnitId) || relatableOptions[0]
  }, [relatableOptions, selectedUnitId])

  const handleStartEditPrice = (unit) => {
    setEditPriceInput(String(unit.unitPrice))
    setIsEditingPrice(true)
  }

  const handleSavePrice = () => {
    const num = Math.round(Number(editPriceInput))
    if (!isNaN(num) && num > 0) {
      setCustomPrices(prev => ({
        ...prev,
        [selectedUnitId]: num
      }))
    }
    setIsEditingPrice(false)
  }

  const handleResetPrices = () => {
    setCustomPrices({})
    setIsEditingPrice(false)
  }

  return (
    <div className="card spending-breakdown-card" aria-label="Spending breakdown summary">
      {/* Header with Title and Mode Toggle */}
      <div className="spending-breakdown-header">
        <div>
          <span className="section-kicker">SPENDING BREAKDOWN</span>
          <h3>Where Did My Money Go?</h3>
        </div>

        <div className="spending-header-right">
          {/* Two-state Mode Toggle */}
          <div
            className="relatable-toggle-pill"
            role="tablist"
            aria-label="Currency display mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'rupees'}
              className={`relatable-toggle-btn ${mode === 'rupees' ? 'active' : ''}`}
              onClick={() => setMode('rupees')}
              title="View spending in Indian Rupees"
            >
              ₹ Rupees
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'relatable'}
              className={`relatable-toggle-btn ${mode === 'relatable' ? 'active' : ''}`}
              onClick={() => setMode('relatable')}
              title="Convert spending into familiar everyday items"
            >
              🧋 Relatable
            </button>
          </div>

          <span className="period" style={{ color: '#9db09f', fontSize: '11px', fontFamily: 'DM Mono, monospace' }}>
            {txCount} spends logged
          </span>
        </div>
      </div>

      {totalSpent > 0 && categories.length > 0 ? (
        <>
          {/* Relatable Mode: Unit Selector Bar and Configurable Prices */}
          {mode === 'relatable' && (
            <div className="relatable-controls-panel">
              <div className="relatable-unit-selector">
                <span className="relatable-unit-kicker">CONVERT TO:</span>
                <div className="relatable-unit-chips" role="radiogroup" aria-label="Select relatable unit">
                  {relatableOptions.map(unit => {
                    const isSelected = unit.id === selectedUnitId
                    return (
                      <button
                        key={unit.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`relatable-unit-chip ${isSelected ? 'selected' : ''}`}
                        onClick={() => {
                          setSelectedUnitId(unit.id)
                          setIsEditingPrice(false)
                        }}
                      >
                        <span className="unit-icon">{unit.icon}</span>
                        <span className="unit-name">{unit.name}</span>
                        <span className="unit-price-tag">₹{unit.unitPrice}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Configurable Unit Price Bar */}
              <div className="relatable-price-config-bar">
                <div className="price-info">
                  <span>Assumed unit price:</span>
                  <strong>₹{activeUnit.unitPrice} per {activeUnit.singular}</strong>
                </div>

                {isEditingPrice ? (
                  <div className="price-edit-form">
                    <span className="currency-prefix">₹</span>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      className="price-input"
                      value={editPriceInput}
                      onChange={(e) => setEditPriceInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSavePrice()
                        if (e.key === 'Escape') setIsEditingPrice(false)
                      }}
                      autoFocus
                    />
                    <button type="button" className="price-save-btn" onClick={handleSavePrice}>
                      Save
                    </button>
                    <button type="button" className="price-cancel-btn" onClick={() => setIsEditingPrice(false)}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <div className="price-actions">
                    <button
                      type="button"
                      className="price-edit-btn"
                      onClick={() => handleStartEditPrice(activeUnit)}
                      title={`Configure price for ${activeUnit.name}`}
                    >
                      ✎ Edit price
                    </button>
                    {customPrices[activeUnit.id] && (
                      <button
                        type="button"
                        className="price-reset-btn"
                        onClick={handleResetPrices}
                        title="Reset to default rate"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Everyday Equivalents Showcase (e.g. ₹500 = 25 samosas / 5 boba teas) */}
              <div className="relatable-showcase-strip" aria-label="Spending everyday equivalents">
                <span className="showcase-label">₹{totalSpent.toLocaleString('en-IN')} EQUALS:</span>
                <div className="showcase-items">
                  {relatableOptions.map(u => (
                    <span
                      key={u.id}
                      className={`showcase-item ${u.id === selectedUnitId ? 'highlight' : ''}`}
                      onClick={() => setSelectedUnitId(u.id)}
                      title={`Click to view breakdown in ${u.name}`}
                    >
                      <i>{u.icon}</i> <b>{u.formattedQuantity}</b> {u.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Category List */}
          <div className="spending-category-list">
            {categories.slice(0, 4).map(([category, amount]) => {
              const pct = Math.min(100, Math.round((amount / safeTotal) * 100))
              const color = CATEGORY_COLORS[category] || '#67ff3a'
              const unitConversion = convertToUnit(amount, selectedUnitId, customPrices)

              return (
                <div key={category} className="spending-category-row">
                  <div className="spending-category-meta">
                    <span className="spending-category-name">
                      <i className="spending-category-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
                      {category}
                    </span>

                    <div className="spending-category-values">
                      {mode === 'rupees' ? (
                        <>
                          <span className="spending-category-amount">
                            <AnimatedNumber value={amount} prefix="₹" formatIndian />
                          </span>
                          <span className="spending-category-pct">({pct}%)</span>
                        </>
                      ) : (
                        <div className="spending-relatable-item-box">
                          <span className="spending-relatable-qty">
                            <span className="relatable-row-icon">{unitConversion.icon}</span>
                            <strong>{unitConversion.formattedQuantity}</strong> {unitConversion.label}
                          </span>
                          <span className="spending-relatable-fiat">
                            (@ ₹{unitConversion.unitPrice} · ₹{amount.toLocaleString('en-IN')})
                          </span>
                          <span className="spending-category-pct">({pct}%)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="spending-bar-track">
                    <div
                      className="spending-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: color,
                        color: color
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary Footer */}
          <div className={`spending-summary-footer ${mode === 'relatable' ? 'relatable-mode-footer' : ''}`}>
            {mode === 'rupees' ? (
              <>
                <span>Total Outflow</span>
                <strong>
                  <AnimatedNumber value={totalSpent} prefix="₹" formatIndian />
                </strong>
              </>
            ) : (
              <>
                <div className="footer-fiat-recap">
                  <span>Total Outflow</span>
                  <small>₹{totalSpent.toLocaleString('en-IN')} total (@ ₹{activeUnit.unitPrice} per {activeUnit.singular})</small>
                </div>
                <div className="footer-relatable-total">
                  <span className="footer-unit-icon">{activeUnit.icon}</span>
                  <strong>{activeUnit.formattedQuantity} {activeUnit.label}</strong>
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="empty-spending-state" style={{ padding: '24px 10px', textAlign: 'center' }}>
          <span className="empty-state-icon" style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>
            📊
          </span>
          <strong style={{ display: 'block', fontSize: '15px', color: '#f2f8f1', marginBottom: '4px' }}>
            No spends logged yet
          </strong>
          <p style={{ margin: '0 0 14px', fontSize: '12px', color: '#9daea0' }}>
            Log an expense or scan a receipt to see your animated spending breakdown and relatable everyday equivalents.
          </p>
          {onAddSpend && (
            <button
              type="button"
              className="primary-button"
              onClick={onAddSpend}
              style={{ fontSize: '12px', padding: '8px 16px' }}
            >
              ＋ Log spend (+2 ✦)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
