import React, { useState, useEffect } from 'react'

export default function SmartBuyPriceChart({ offers }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(timer)
  }, [offers])

  if (!offers || offers.length <= 1) return null

  const validPrices = offers
    .map(o => o.price)
    .filter(p => typeof p === 'number' && p > 0)

  if (validPrices.length === 0) return null

  const minPrice = Math.min(...validPrices)
  const maxPrice = Math.max(...validPrices)

  return (
    <div className="smartbuy-chart-card card">
      <div className="smartbuy-chart-title-row">
        <h3>Price Comparison at a Glance</h3>
        <span>Ranked lowest to highest</span>
      </div>

      <div className="smartbuy-bars-list">
        {offers.map((offer, idx) => {
          const isLowest = offer.isLowestOffer || offer.price === minPrice
          const diff = offer.priceDifference || (offer.price - minPrice)

          let barPct = 100
          if (maxPrice > 0) {
            const range = maxPrice - minPrice
            if (range > 0) {
              const fraction = (offer.price - minPrice) / range
              barPct = 40 + fraction * 60
            } else {
              barPct = 85
            }
          }

          return (
            <div
              key={`${offer.retailer}_${idx}`}
              className={`smartbuy-bar-row ${isLowest ? 'lowest-row' : ''}`}
            >
              <div className="bar-store-name">
                <span>{offer.retailer || 'Store'}</span>
                {isLowest && <span className="bar-lowest-pill">Lowest</span>}
              </div>

              <div className="bar-track-wrap" aria-hidden="true">
                <div
                  className={`bar-fill ${isLowest ? 'lowest' : ''}`}
                  style={{
                    width: animated ? `${Math.min(100, Math.max(15, barPct))}%` : '0%',
                    transitionDelay: `${idx * 60}ms`,
                  }}
                />
              </div>

              <div className="bar-price-meta">
                <span className="bar-price-val">₹{(offer.price || 0).toLocaleString('en-IN')}</span>
                {diff > 0 ? (
                  <span className="bar-diff-val">+₹{diff.toLocaleString('en-IN')}</span>
                ) : (
                  <span className="bar-diff-val" style={{ color: '#67ff3a' }}>Best deal</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
