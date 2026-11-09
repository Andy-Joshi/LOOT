import React from 'react'
import { isProductUrl } from '../../services/smartBuyApi'

function formatDisplayQuery(str) {
  if (!str) return ''
  if (isProductUrl(str)) {
    try {
      const parsed = new URL(str.startsWith('http') ? str : `https://${str}`)
      const pathSnippet = parsed.pathname.length > 24 ? parsed.pathname.slice(0, 24) + '…' : parsed.pathname
      return `${parsed.hostname}${pathSnippet}`
    } catch {
      return str.length > 40 ? str.slice(0, 40) + '…' : str
    }
  }
  return str.length > 60 ? str.slice(0, 60) + '…' : str
}

export default function SmartBuyEmptyState({
  queryOrUrl,
  error,
  isBlocked,
  onRetry,
  onLoadSample,
  onOpenHowWeChecked,
}) {
  const displayQuery = formatDisplayQuery(queryOrUrl)

  return (
    <div className="card" style={{ padding: '36px 24px', textAlign: 'center', background: '#121c13', border: '1px solid #364d37' }}>
      <div style={{ fontSize: '36px', marginBottom: '14px' }} aria-hidden="true">
        {isBlocked ? '🛡️' : '🔍'}
      </div>

      <h3 style={{ margin: '0 0 8px', fontSize: '20px', color: '#f2f8f1' }}>
        {isBlocked
          ? "Couldn't reach store page directly"
          : error
          ? "Couldn't load prices for this search"
          : 'No store offers found'}
      </h3>

      <p style={{ margin: '0 auto 20px', fontSize: '13px', color: '#a4b8a6', maxWidth: '440px', lineHeight: '1.5' }}>
        {isBlocked
          ? 'This retailer asks for verification or restricts automated checks. Try searching by model name or try another store link.'
          : error ||
            `We searched across Indian stores, but couldn't find exact matches for "${displayQuery}". Try searching for the brand and model number.`}
      </p>

      {displayQuery && (
        <div style={{ display: 'inline-block', marginBottom: '20px', padding: '6px 14px', borderRadius: '6px', background: '#162518', border: '1px solid #293b2a', fontSize: '12px', fontFamily: "'DM Mono', monospace", color: '#c8d9ca', maxWidth: '90%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Searched: <strong style={{ color: '#67ff3a' }}>{displayQuery}</strong>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
        {onRetry && (
          <button
            type="button"
            className="primary-button"
            onClick={onRetry}
            style={{ padding: '10px 20px', fontSize: '13px' }}
          >
            Try again
          </button>
        )}

        {onLoadSample && (
          <button
            type="button"
            className="secondary-button"
            onClick={onLoadSample}
            style={{ padding: '10px 18px', fontSize: '13px' }}
          >
            See sample comparison
          </button>
        )}
      </div>

      {onOpenHowWeChecked && (
        <div style={{ marginTop: '20px' }}>
          <button
            type="button"
            className="text-button"
            onClick={onOpenHowWeChecked}
            style={{ fontSize: '12px', color: '#8fa291' }}
          >
            View transparency &amp; how we checked →
          </button>
        </div>
      )}
    </div>
  )
}
