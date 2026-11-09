import React from 'react'

export default function SmartBuyRankedStores({ offers }) {
  if (!offers || offers.length === 0) return null

  return (
    <div className="smartbuy-ranked-section">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '4px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', color: '#f2f8f1' }}>All Store Offers</h3>
        <span style={{ fontSize: '12px', color: '#8fa291', fontFamily: "'DM Mono', monospace" }}>
          {offers.length} {offers.length === 1 ? 'store checked' : 'stores ranked'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {offers.map((offer, index) => {
          const isLowest = offer.isLowestOffer || (offer.priceDifference === 0)
          const diff = offer.priceDifference || 0

          let deliveryText = 'Delivery terms on store'
          if (offer.shippingCharge === 0) {
            deliveryText = 'Free Delivery'
          } else if (offer.shippingCharge > 0) {
            deliveryText = `₹${offer.shippingCharge} Delivery`
          }

          return (
            <div
              key={`${offer.retailer}_${index}`}
              className={`smartbuy-ranked-card ${isLowest ? 'is-lowest' : ''}`}
            >
              <div className="ranked-card-info">
                <span className="ranked-num-pill">#{index + 1}</span>
                <div className="ranked-details">
                  <h4>{offer.retailer}</h4>
                  <p>
                    {deliveryText} · {offer.verificationStatus === 'VERIFIED_PAGE' ? '✓ Verified' : 'Listing'}
                  </p>
                </div>
              </div>

              <div className="ranked-card-action">
                <div className="ranked-price-block">
                  <strong>₹{(offer.price || 0).toLocaleString('en-IN')}</strong>
                  {diff > 0 ? (
                    <span className="ranked-diff-lbl">+₹{diff.toLocaleString('en-IN')}</span>
                  ) : (
                    <span className="ranked-diff-lbl" style={{ color: '#67ff3a' }}>Lowest Price</span>
                  )}
                </div>

                {offer.url && (
                  <a
                    href={offer.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={isLowest ? 'primary-button ranked-buy-btn' : 'secondary-button ranked-buy-btn'}
                  >
                    <span>View Deal</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
