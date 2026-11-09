import React, { useState, useEffect } from 'react'

/**
 * Supported retailers matching Smart Buy microservice providers
 */
const SUPPORTED_RETAILERS = [
  { id: 'amazon', name: 'Amazon India', icon: '🛒' },
  { id: 'flipkart', name: 'Flipkart', icon: '⚡' },
  { id: 'croma', name: 'Croma', icon: '🏬' },
  { id: 'reliancedigital', name: 'Reliance Digital', icon: '📱' },
  { id: 'vijaysales', name: 'Vijay Sales', icon: '🛍️' },
]

/**
 * Helper to get user-facing label and styling badge for each state:
 * - waiting: neutral subtle indicator
 * - searching: subtle animated radar/pulse indicator
 * - completed: subtle green indicator
 * - unavailable: neutral muted indicator
 * - failed: restrained warning indicator
 */
function getStatusMeta(state) {
  switch (state) {
    case 'completed':
      return {
        label: 'Completed',
        symbol: '✓',
        badgeClass: 'status-completed',
        ariaLabel: 'Search completed successfully'
      }
    case 'searching':
      return {
        label: 'Searching',
        symbol: '◎',
        badgeClass: 'status-searching',
        ariaLabel: 'Currently querying store'
      }
    case 'unavailable':
      return {
        label: 'Unavailable',
        symbol: '—',
        badgeClass: 'status-unavailable',
        ariaLabel: 'Store currently unavailable'
      }
    case 'failed':
      return {
        label: 'Failed',
        symbol: '!',
        badgeClass: 'status-failed',
        ariaLabel: 'Store search encountered an error'
      }
    case 'waiting':
    default:
      return {
        label: 'Waiting',
        symbol: '○',
        badgeClass: 'status-waiting',
        ariaLabel: 'Queued for search'
      }
  }
}

export default function SmartBuyLoadingState({
  providerStatuses = null,
  hasFailed = false
}) {
  // Store progressive scanning states across the 5 verified retailers
  const [storeStates, setStoreStates] = useState({
    amazon: 'searching',
    flipkart: 'waiting',
    croma: 'waiting',
    reliancedigital: 'waiting',
    vijaysales: 'waiting',
  })

  // Progressive live sequence while network request is active
  useEffect(() => {
    // If real provider statuses are fed from parent, do not simulate sequence
    if (providerStatuses && Object.keys(providerStatuses).length > 0) {
      return
    }

    // Sequence active scanning progression across stores
    // Note: The final store stays in 'searching' until backend completes.
    // It NEVER falsely shows 100% completion while the request is still running.
    const t1 = setTimeout(() => {
      setStoreStates(prev => ({ ...prev, amazon: 'completed', flipkart: 'searching' }))
    }, 700)

    const t2 = setTimeout(() => {
      setStoreStates(prev => ({ ...prev, flipkart: 'completed', croma: 'searching' }))
    }, 1500)

    const t3 = setTimeout(() => {
      setStoreStates(prev => ({ ...prev, croma: 'completed', reliancedigital: 'searching' }))
    }, 2400)

    const t4 = setTimeout(() => {
      setStoreStates(prev => ({ ...prev, reliancedigital: 'completed', vijaysales: 'searching' }))
    }, 3300)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [providerStatuses])

  const activeStates = (providerStatuses && Object.keys(providerStatuses).length > 0)
    ? providerStatuses
    : storeStates

  return (
    <div className="smartbuy-loading-card card" role="status" aria-live="polite">
      {/* 1. Sleek top scanning laser beam */}
      <div className="smartbuy-scan-beam-track" aria-hidden="true">
        <div className="smartbuy-scan-beam" />
      </div>

      {/* 2. Compact, balanced header */}
      <div className="smartbuy-loading-head">
        <div className="smartbuy-loading-pulse-ring" aria-hidden="true">
          <span className="smartbuy-pulse-core" />
        </div>
        <div className="smartbuy-loading-titles">
          <h3>Comparing store prices...</h3>
          <p className="smartbuy-loading-sub">Checking verified retailers for the best deal.</p>
        </div>
      </div>

      {/* 3. Individual Retailer Status Indicators */}
      <div className="smartbuy-retailers-grid">
        {SUPPORTED_RETAILERS.map(retailer => {
          let state = activeStates[retailer.id] || 'waiting'
          if (hasFailed && state === 'searching') {
            state = 'failed'
          }
          const meta = getStatusMeta(state)

          return (
            <div
              key={retailer.id}
              className={`smartbuy-retailer-tile state-${state}`}
              aria-label={`${retailer.name}: ${meta.label}`}
            >
              <div className="retailer-tile-brand">
                <span className="retailer-tile-icon" aria-hidden="true">{retailer.icon}</span>
                <span className="retailer-tile-name">{retailer.name}</span>
              </div>

              <div className={`retailer-status-badge ${meta.badgeClass}`}>
                <span className="status-symbol" aria-hidden="true">{meta.symbol}</span>
                <span className="status-label">{meta.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
