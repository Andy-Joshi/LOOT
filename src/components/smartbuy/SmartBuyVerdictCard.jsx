import React, { useState } from 'react'

export default function SmartBuyVerdictCard({
  comparison,
  productTitle,
  onSaveGoal,
  onAskParent,
  onSleepOnIt,
  isSleepActive = false,
}) {
  const [whyDifferOpen, setWhyDifferOpen] = useState(false)
  const [goalSaved, setGoalSaved] = useState(false)
  const [parentShared, setParentShared] = useState(false)

  const lowestOffer = comparison?.lowestOffer || {}
  const targetPrice = lowestOffer.price || 0
  const originalPrice = lowestOffer.originalPrice || 0
  const savings = comparison?.potentialSavings || 0
  const savingsPct = comparison?.savingsPercentage || 0
  const storeName = lowestOffer.retailer || 'Best Store'
  const highestOffer = comparison?.highestOffer

  const handleGoalClick = () => {
    setGoalSaved(true)
    if (onSaveGoal) {
      onSaveGoal({
        item: productTitle || 'Selected Product',
        price: targetPrice,
        store: storeName,
        url: lowestOffer.url || '',
        highestPrice: highestOffer?.price || targetPrice,
        savings,
      })
    }
    setTimeout(() => setGoalSaved(false), 3000)
  }

  const handleAskParentClick = () => {
    setParentShared(true)
    if (onAskParent) {
      onAskParent({
        item: productTitle || 'Selected Product',
        price: targetPrice,
        store: storeName,
        url: lowestOffer.url || '',
        highestPrice: highestOffer?.price || targetPrice,
        savings,
      })
    }
    setTimeout(() => setParentShared(false), 3000)
  }

  const handleSleepClick = () => {
    if (onSleepOnIt) {
      onSleepOnIt({
        item: productTitle || 'Selected Product',
        price: targetPrice,
        store: storeName,
        url: lowestOffer.url || '',
        highestPrice: highestOffer?.price || targetPrice,
        savings,
      })
    }
  }

  return (
    <div className="smartbuy-verdict-card card">
      {/* Header Badges */}
      <div className="verdict-header-row">
        <div className="verdict-badge-pills">
          <span className="verdict-tag-best">
            ★ Best Price Found
          </span>
          <span className="verdict-store-pill">
            {storeName}
          </span>
          <span className="verdict-verified-pill" title="Verified against live retailer listing">
            ✓ Verified Listing
          </span>
        </div>

        {highestOffer && highestOffer.retailer !== storeName && (
          <span className="verdict-vs-highest">
            vs ₹{(highestOffer.price || 0).toLocaleString('en-IN')} on {highestOffer.retailer}
          </span>
        )}
      </div>

      {/* Main Price & Savings */}
      <div className="verdict-price-container">
        <span className="verdict-main-price">
          ₹{targetPrice > 0 ? targetPrice.toLocaleString('en-IN') : 'Check Store'}
        </span>

        {originalPrice > targetPrice && (
          <span className="verdict-mrp">
            MRP: ₹{originalPrice.toLocaleString('en-IN')}
          </span>
        )}

        {savings > 0 && (
          <span className="verdict-savings-tag">
            <span>💸</span>
            <span>
              Save <strong>₹{savings.toLocaleString('en-IN')}</strong> ({savingsPct}% vs highest)
            </span>
          </span>
        )}
      </div>

      {lowestOffer.url && (
        <div style={{ marginBottom: '18px' }}>
          <a
            href={lowestOffer.url}
            target="_blank"
            rel="noopener noreferrer"
            className="primary-button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px', fontSize: '14px' }}
          >
            <span>Buy on {storeName}</span>
            <span aria-hidden="true">↗</span>
          </a>
        </div>
      )}

      {/* LOOT Integrated Action Buttons Strip */}
      <div className="verdict-actions-strip">
        <button
          type="button"
          className={`verdict-action-pill ${goalSaved ? 'active' : ''}`}
          onClick={handleGoalClick}
        >
          <span>{goalSaved ? '✓' : '🎯'}</span>
          <span>{goalSaved ? 'Goal Saved!' : 'Save as goal'}</span>
        </button>

        <button
          type="button"
          className={`verdict-action-pill ${parentShared ? 'active' : ''}`}
          onClick={handleAskParentClick}
        >
          <span>{parentShared ? '✓' : '💬'}</span>
          <span>{parentShared ? 'Pitch Sent!' : 'Ask a parent'}</span>
        </button>

        <button
          type="button"
          className={`verdict-action-pill ${isSleepActive ? 'active' : ''}`}
          onClick={handleSleepClick}
        >
          <span>🌙</span>
          <span>{isSleepActive ? 'Reminding in 24h (Active)' : 'Sleep on it (24h)'}</span>
        </button>
      </div>

      {/* Collapsible Info: Why prices differ */}
      <div style={{ marginTop: '16px' }}>
        <button
          type="button"
          className="text-button"
          onClick={() => setWhyDifferOpen(!whyDifferOpen)}
          style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <span>💡 Why prices differ across stores</span>
          <span>{whyDifferOpen ? '▴' : '▾'}</span>
        </button>

        {whyDifferOpen && (
          <div className="verdict-why-differ">
            Retailers dynamically adjust pricing based on bank card tie-ups, seasonal inventory, and regional fulfillment costs. Always check checkout for instant bank discounts!
          </div>
        )}
      </div>
    </div>
  )
}
