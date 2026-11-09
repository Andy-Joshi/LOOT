import React, { useState } from 'react'

export default function SmartBuyProductSummary({ productIntelligence, targetIdentity, startingProduct }) {
  const [imageError, setImageError] = useState(false)

  const brand = targetIdentity?.brand || startingProduct?.brand || productIntelligence?.identity?.brand || ''
  const model = targetIdentity?.model || startingProduct?.model || productIntelligence?.identity?.model || ''
  const variant = targetIdentity?.storage || targetIdentity?.ram || productIntelligence?.identity?.variant || ''
  const category = productIntelligence?.identity?.category || targetIdentity?.category || 'Electronics'

  const title = (brand && model)
    ? `${brand} ${model} ${variant}`.trim()
    : (targetIdentity?.cleanTitle || startingProduct?.title || 'Selected Product')

  const imageUrl = !imageError ? (productIntelligence?.identity?.imageUrl || startingProduct?.image) : null
  const descriptionText = productIntelligence?.description?.text || ''
  const specsList = productIntelligence?.specifications?.items || []

  return (
    <div className="smartbuy-product-summary-card card">
      <div className="product-summary-grid">
        <div className="product-img-box">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={title}
              onError={() => setImageError(true)}
            />
          ) : (
            <span style={{ fontSize: '32px' }} aria-hidden="true">🛍️</span>
          )}
        </div>

        <div className="product-summary-details">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
            <span className="section-kicker" style={{ fontSize: '10px' }}>{category}</span>
            {brand && <span className="section-kicker" style={{ fontSize: '10px', color: '#c9a8ff' }}>{brand}</span>}
            {variant && <span className="section-kicker" style={{ fontSize: '10px', color: '#67ff3a' }}>{variant}</span>}
          </div>

          <h3>{title}</h3>

          {descriptionText && (
            <p>{descriptionText}</p>
          )}

          {specsList.length > 0 && (
            <div className="product-specs-list">
              {specsList.slice(0, 6).map((spec, i) => (
                <div key={i} className="spec-item">
                  <span className="spec-lbl">{spec.label}</span>
                  <span className="spec-val">{spec.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
