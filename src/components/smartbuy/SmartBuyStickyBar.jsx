import React from 'react'

export default function SmartBuyStickyBar({ lowestOffer }) {
  if (!lowestOffer || !lowestOffer.price) return null

  const storeName = lowestOffer.retailer || 'Best Store'
  const price = lowestOffer.price

  return (
    <aside className="smartbuy-sticky-bar" aria-label="Quick deal action">
      <div className="sticky-details">
        <span className="sticky-store">Best on {storeName}:</span>
        <span className="sticky-price">₹{price.toLocaleString('en-IN')}</span>
      </div>

      <a
        href={lowestOffer.url || '#'}
        target="_blank"
        rel="noopener noreferrer"
        className="primary-button sticky-deal-btn"
        aria-label={`Buy on ${storeName} for ${price.toLocaleString('en-IN')}`}
      >
        <span>View Deal</span>
        <span aria-hidden="true">↗</span>
      </a>
    </aside>
  )
}
