import React, { useState, useRef } from 'react'
import './SmartBuy.css'
import SmartBuyVerdictCard from './SmartBuyVerdictCard'
import SmartBuyPriceChart from './SmartBuyPriceChart'
import SmartBuyRankedStores from './SmartBuyRankedStores'
import SmartBuyProductSummary from './SmartBuyProductSummary'
import SmartBuyLoadingState from './SmartBuyLoadingState'
import SmartBuyHowCheckedModal from './SmartBuyHowCheckedModal'
import SmartBuyEmptyState from './SmartBuyEmptyState'
import SmartBuyStickyBar from './SmartBuyStickyBar'
import {
  searchProductByName,
  searchProductByUrl,
  isProductUrl,
  getSampleSmartBuyData
} from '../../services/smartBuyApi'

const EXAMPLE_CHIPS = [
  'iPhone 17 Pro',
  'Sony WH-CH720N',
  'boAt Airdopes',
  'MacBook Air M3'
]

const SUPPORTED_STORES = [
  { name: 'Amazon', icon: '🛒' },
  { name: 'Flipkart', icon: '⚡' },
  { name: 'Croma', icon: '🏬' },
  { name: 'Reliance Digital', icon: '📱' },
  { name: 'Vijay Sales', icon: '🛍️' }
]

/**
 * Intelligent category icon detection for clean history cards
 */
function getProductCategoryIcon(name = '') {
  const lower = name.toLowerCase()
  if (lower.includes('macbook') || lower.includes('laptop') || lower.includes('vivobook') || lower.includes('thinkpad') || lower.includes('dell') || lower.includes('hp') || lower.includes('zenbook')) {
    return '💻'
  }
  if (lower.includes('iphone') || lower.includes('nord') || lower.includes('phone') || lower.includes('samsung') || lower.includes('pixel') || lower.includes('oneplus') || lower.includes('redmi') || lower.includes('galaxy') || lower.includes('realme')) {
    return '📱'
  }
  if (lower.includes('wh-') || lower.includes('headphone') || lower.includes('airdopes') || lower.includes('earbuds') || lower.includes('earphone') || lower.includes('airpods') || lower.includes('boat') || lower.includes('sony')) {
    return '🎧'
  }
  if (lower.includes('watch') || lower.includes('band') || lower.includes('fitbit')) {
    return '⌚'
  }
  if (lower.includes('tv') || lower.includes('monitor') || lower.includes('display') || lower.includes('screen')) {
    return '📺'
  }
  if (lower.includes('playstation') || lower.includes('ps5') || lower.includes('xbox') || lower.includes('switch') || lower.includes('console')) {
    return '🎮'
  }
  if (lower.includes('ipad') || lower.includes('tablet') || lower.includes('tab')) {
    return '📟'
  }
  return '🛍️'
}

/**
 * Defensively format history product name if legacy URL was stored
 */
function formatHistoryName(name) {
  if (!name || typeof name !== 'string') return 'Product'
  if (isProductUrl(name)) {
    try {
      const parsed = new URL(name.startsWith('http') ? name : `https://${name}`)
      const pathSegments = parsed.pathname.split('/').filter(Boolean)
      const slug = pathSegments.find(s => s.length > 5 && !s.match(/^[0-9]+$/)) || pathSegments.pop() || parsed.hostname
      const cleaned = slug.replace(/[-_]/g, ' ').replace(/\b(dp|p|itm|product|buy|online)\b/gi, '').replace(/\s+/g, ' ').trim()
      return cleaned || parsed.hostname
    } catch {
      return 'Store Product'
    }
  }
  return name
}

export default function SmartBuyView({
  onSaveGoal,
  onAskParent,
  onSleepOnIt,
  onComparisonCompleted,
  smartBuySavings = 0,
  recentComparisons = [],
  onSelectRecentComparison,
  notify,
  sleepReminders = []
}) {
  const [inputVal, setInputVal] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [searchData, setSearchData] = useState(null)
  const [currentQuery, setCurrentQuery] = useState('')
  const [apiError, setApiError] = useState(null)
  const [showHowWeChecked, setShowHowWeChecked] = useState(false)
  const inputRef = useRef(null)

  // Execute Search
  const handleSearch = async (rawQuery) => {
    const queryOrUrl = (rawQuery || inputVal).trim()
    if (!queryOrUrl) {
      if (notify) notify('Type a product name or paste any store link.')
      inputRef.current?.focus()
      return
    }

    setIsLoading(true)
    setCurrentQuery(queryOrUrl)
    setSearchData(null)
    setApiError(null)

    const isUrl = isProductUrl(queryOrUrl)

    try {
      let data
      if (isUrl) {
        data = await searchProductByUrl(queryOrUrl)
      } else {
        data = await searchProductByName(queryOrUrl)
      }

      setSearchData(data)

      if (data?.comparison?.comparedOffers?.length > 0) {
        if (onComparisonCompleted) {
          onComparisonCompleted(data)
        }
      }
    } catch (err) {
      setApiError(err.message || 'Network error connecting to Smart Buy engine.')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle Load Sample Data
  const handleLoadSample = () => {
    setIsLoading(false)
    setApiError(null)
    setCurrentQuery('iPhone 17 Pro 256GB')
    setInputVal('iPhone 17 Pro 256GB')
    const sample = getSampleSmartBuyData()
    setSearchData(sample)
    if (notify) notify('Loaded instant sample comparison data')
    if (onComparisonCompleted) {
      onComparisonCompleted(sample)
    }
  }

  // Handle Retry
  const handleRetry = () => {
    if (currentQuery) {
      handleSearch(currentQuery)
    } else {
      handleLoadSample()
    }
  }

  // Handle Paste from Clipboard
  const handlePaste = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText()
        if (text && text.trim()) {
          setInputVal(text.trim())
          handleSearch(text.trim())
          return
        }
      }
    } catch {
      // Graceful fallback
    }
    inputRef.current?.focus()
  }

  // Handle selecting a recent comparison history item
  const handleSelectHistoryItem = (item) => {
    const query = item?.item || ''
    if (!query) return

    setInputVal(query)

    if (item.searchData && item.searchData.comparison) {
      // Instant reload from cached comparison if available
      setSearchData(item.searchData)
      setCurrentQuery(query)
      setApiError(null)
    } else {
      // Re-run search
      handleSearch(query)
    }

    if (onSelectRecentComparison) {
      onSelectRecentComparison(item)
    }
  }

  // Check if current item has active sleep reminder
  const currentItemTitle = searchData?.targetIdentity?.cleanTitle || searchData?.query || currentQuery
  const isSleepActive = sleepReminders.some(r => r.item === currentItemTitle && !r.dismissed)

  const hasResults =
    searchData &&
    searchData.success !== false &&
    searchData.comparison &&
    searchData.comparison.comparedOffers &&
    searchData.comparison.comparedOffers.length > 0

  const lowestOffer = searchData?.comparison?.lowestOffer
  const comparedOffers = searchData?.comparison?.comparedOffers || []
  const rejectedListings = searchData?.results?.rejectedListings || []

  return (
    <div className="smartbuy-page-wrap">
      {/* 1. Header / Intro Banner */}
      <section className="smartbuy-hero-banner card">
        <div className="smartbuy-hero-grid">
          <div className="smartbuy-hero-text">
            <span className="section-kicker">SMART BUY · VERIFIED PRICE COMPARISON</span>
            <h1>Never overpay for gear or gadgets</h1>
            <p>
              Compare live prices across verified Indian retailers (Amazon, Flipkart, Croma, Reliance Digital, Vijay Sales). Find the lowest verified price, save as a goal, or ask a parent in one tap.
            </p>
          </div>

          <div className="smartbuy-savings-metric">
            <span className="smartbuy-metric-icon" aria-hidden="true">🛍️</span>
            <div className="smartbuy-metric-info">
              <span className="smartbuy-metric-lbl">Saved by Comparing</span>
              <strong className="smartbuy-metric-val">₹{smartBuySavings.toLocaleString('en-IN')}</strong>
              <small>Optimized purchase decisions</small>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Refined Search Section */}
      <section className="smartbuy-search-card card">
        <form onSubmit={(e) => { e.preventDefault(); handleSearch(inputVal); }}>
          <div className="smartbuy-input-row">
            <div className="smartbuy-input-wrap">
              <span className="smartbuy-search-icon" aria-hidden="true">🔍</span>
              <input
                ref={inputRef}
                type="text"
                className="smartbuy-input"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Search product (e.g. iPhone 17 Pro) or paste a store link..."
                autoComplete="off"
              />
              {inputVal && (
                <button
                  type="button"
                  className="smartbuy-clear-btn"
                  onClick={() => {
                    setInputVal('')
                    inputRef.current?.focus()
                  }}
                  title="Clear search"
                  aria-label="Clear input"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="smartbuy-actions-group">
              <button
                type="button"
                className="secondary-button smartbuy-paste-btn"
                onClick={handlePaste}
                title="Paste from clipboard"
              >
                📋 Paste
              </button>

              <button
                type="submit"
                className="primary-button smartbuy-search-btn"
                disabled={isLoading}
              >
                {isLoading ? 'Scanning...' : 'Compare Prices'}
              </button>

              <button
                type="button"
                className="secondary-button smartbuy-sample-btn"
                onClick={handleLoadSample}
                title="Try instant sample comparison"
              >
                Try Sample
              </button>
            </div>
          </div>

          <div className="smartbuy-search-footer">
            <div className="smartbuy-chips-wrap">
              <span className="smartbuy-chips-lbl">SUGGESTIONS:</span>
              {EXAMPLE_CHIPS.map(chip => (
                <button
                  key={chip}
                  type="button"
                  className="smartbuy-chip"
                  onClick={() => {
                    setInputVal(chip)
                    handleSearch(chip)
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>

            <div className="smartbuy-supported-stores">
              <span className="supported-stores-lbl">Verified retailers:</span>
              <div className="supported-stores-pills">
                {SUPPORTED_STORES.map(s => (
                  <span key={s.name} className="supported-store-pill" title={`Verified: ${s.name}`}>
                    <span aria-hidden="true">{s.icon}</span> {s.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </form>
      </section>

      {/* Sample Demo Banner */}
      {searchData?.isSampleDemo && (
        <div className="smartbuy-demo-banner">
          <div className="demo-badge-wrap">
            <span className="demo-pill">Sample Demo</span>
            <span className="demo-text">
              Showing high-fidelity comparison for Apple iPhone 17 Pro 256GB. Search any real product above for live store prices!
            </span>
          </div>
          <button
            type="button"
            className="clear-demo-btn"
            onClick={() => {
              setSearchData(null)
              setCurrentQuery('')
              setInputVal('')
            }}
          >
            Clear Demo
          </button>
        </div>
      )}

      {/* 3. Refined Comparison Progress Panel */}
      {isLoading && (
        <SmartBuyLoadingState />
      )}

      {/* 4. Error Alert */}
      {apiError && !isLoading && (
        <div className="smartbuy-error-card" role="alert">
          <div className="smartbuy-error-content">
            <span className="smartbuy-error-icon" aria-hidden="true">⚠️</span>
            <div className="smartbuy-error-text">
              <strong>Couldn't fetch store prices</strong>
              <p>{apiError}</p>
            </div>
          </div>
          <button type="button" className="secondary-button" onClick={handleRetry} style={{ minHeight: '40px' }}>
            Retry Search
          </button>
        </div>
      )}

      {/* 5. Results Flow */}
      {!isLoading && searchData && (
        <div className="smartbuy-results-container">
          {hasResults ? (
            <>
              {/* Verdict Card First */}
              <SmartBuyVerdictCard
                comparison={searchData.comparison}
                productTitle={searchData.targetIdentity?.cleanTitle || searchData.query}
                onSaveGoal={onSaveGoal}
                onAskParent={onAskParent}
                onSleepOnIt={onSleepOnIt}
                isSleepActive={isSleepActive}
              />

              {/* Visual Price Comparison Bar Chart */}
              <SmartBuyPriceChart offers={comparedOffers} />

              {/* Ranked Stores List */}
              <SmartBuyRankedStores offers={comparedOffers} />

              {/* Product Specifications & Details */}
              <SmartBuyProductSummary
                productIntelligence={searchData.productIntelligence}
                targetIdentity={searchData.targetIdentity}
                startingProduct={searchData.startingProduct}
              />

              {/* Transparency Link */}
              <div style={{ textAlign: 'center', padding: '8px' }}>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setShowHowWeChecked(true)}
                  style={{ fontSize: '13px', color: '#a4b8a6' }}
                >
                  ✓ Compared {comparedOffers.length} Indian stores · See how we checked →
                </button>
              </div>
            </>
          ) : (
            <SmartBuyEmptyState
              queryOrUrl={currentQuery}
              error={searchData.error}
              isBlocked={searchData.isBlocked}
              onRetry={handleRetry}
              onLoadSample={handleLoadSample}
              onOpenHowWeChecked={() => setShowHowWeChecked(true)}
            />
          )}
        </div>
      )}

      {/* 6. Redesigned Recent Comparisons: Product Names ONLY */}
      {recentComparisons.length > 0 && (
        <section className="smartbuy-history-card card">
          <div className="history-header-row">
            <div>
              <span className="section-kicker">HISTORY</span>
              <h3 className="history-title">Recent Comparisons</h3>
            </div>
            <span className="history-count-badge">
              {recentComparisons.length} {recentComparisons.length === 1 ? 'search' : 'searches'} saved
            </span>
          </div>

          <div className="history-grid">
            {recentComparisons.map((item, idx) => {
              const productName = formatHistoryName(item.item)
              const icon = getProductCategoryIcon(productName)

              return (
                <button
                  key={item.id || idx}
                  type="button"
                  className="history-tile"
                  onClick={() => handleSelectHistoryItem(item)}
                  title={`Revisit comparison for ${productName}`}
                >
                  <span className="history-tile-icon" aria-hidden="true">{icon}</span>
                  <span className="history-item-name">{productName}</span>
                  <span className="history-tile-arrow" aria-hidden="true">→</span>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* 7. Mobile Sticky Bottom Bar */}
      {hasResults && lowestOffer && (
        <SmartBuyStickyBar lowestOffer={lowestOffer} />
      )}

      {/* 8. "How We Checked" Modal */}
      {showHowWeChecked && (
        <SmartBuyHowCheckedModal
          diagnostics={searchData?.diagnostics || {
            searchId: 'smartbuy_demo',
            durationMs: 340,
            providersAttempted: [
              { id: 'croma', name: 'Croma', status: 'Working', resultsCount: 1, durationMs: 140 },
              { id: 'flipkart', name: 'Flipkart', status: 'Working', resultsCount: 1, durationMs: 220 },
              { id: 'amazon', name: 'Amazon India', status: 'Working', resultsCount: 1, durationMs: 280 },
              { id: 'vijaysales', name: 'Vijay Sales', status: 'Working', resultsCount: 1, durationMs: 190 },
              { id: 'reliancedigital', name: 'Reliance Digital', status: 'Working', resultsCount: 205 },
            ],
            listingsDiscovered: 5,
            validPricesExtracted: 5,
          }}
          rejectedListings={rejectedListings}
          onClose={() => setShowHowWeChecked(false)}
        />
      )}
    </div>
  )
}
