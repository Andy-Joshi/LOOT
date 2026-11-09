import React, { useState, useEffect } from 'react'

export default function SmartBuyHowCheckedModal({ diagnostics, rejectedListings, onClose }) {
  const [activeTab, setActiveTab] = useState('stores') // 'stores' | 'excluded'

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!diagnostics) return null

  const providers = diagnostics.providersAttempted || []
  const excluded = rejectedListings || []

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="smartbuy-how-title"
    >
      <div
        className="modal-card"
        style={{ maxWidth: '640px', width: '100%', padding: '28px', background: '#121c13', border: '1px solid #364d37' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <span className="section-kicker" style={{ fontSize: '10px' }}>TRANSPARENCY AUDIT</span>
            <h3 id="smartbuy-how-title" style={{ margin: '4px 0 0', fontSize: '20px', color: '#f2f8f1' }}>
              How We Checked Prices
            </h3>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={onClose}
            style={{ fontSize: '20px', color: '#a4b8a6', padding: '4px 8px' }}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Tab buttons */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '18px', borderBottom: '1px solid #233425', paddingBottom: '10px' }}>
          <button
            type="button"
            className={activeTab === 'stores' ? 'primary-button' : 'secondary-button'}
            style={{ padding: '6px 14px', fontSize: '12px' }}
            onClick={() => setActiveTab('stores')}
          >
            Stores Checked ({providers.length})
          </button>
          {excluded.length > 0 && (
            <button
              type="button"
              className={activeTab === 'excluded' ? 'primary-button' : 'secondary-button'}
              style={{ padding: '6px 14px', fontSize: '12px' }}
              onClick={() => setActiveTab('excluded')}
            >
              Filtered Out ({excluded.length})
            </button>
          )}
        </div>

        {/* Stores list */}
        {activeTab === 'stores' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
            {providers.map((p, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: '#152217',
                  border: '1px solid #253827',
                  borderRadius: '8px',
                }}
              >
                <div>
                  <strong style={{ fontSize: '13px', color: '#f2f8f1' }}>{p.name || p.id}</strong>
                  <small style={{ display: 'block', fontSize: '11px', color: '#8fa291' }}>
                    {p.durationMs ? `${p.durationMs}ms response` : 'Checked'}
                  </small>
                </div>
                <span
                  style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '700',
                    fontFamily: "'DM Mono', monospace",
                    background: p.status === 'Working' ? 'rgba(103, 255, 58, 0.15)' : 'rgba(255, 77, 120, 0.15)',
                    color: p.status === 'Working' ? '#67ff3a' : '#ff7a9e',
                  }}
                >
                  {p.status || 'Checked'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Excluded list */}
        {activeTab === 'excluded' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '340px', overflowY: 'auto' }}>
            {excluded.map((item, i) => (
              <div
                key={i}
                style={{
                  padding: '10px 14px',
                  background: '#1c1518',
                  border: '1px solid #3d252b',
                  borderRadius: '8px',
                }}
              >
                <strong style={{ fontSize: '13px', color: '#ffb3c4' }}>{item.title || 'Listing'}</strong>
                <p style={{ margin: '4px 0 0', fontSize: '11px', color: '#b8949c' }}>
                  {item.reason || 'Did not match exact target specifications'}
                </p>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '20px', textAlign: 'right' }}>
          <button type="button" className="secondary-button" onClick={onClose} style={{ padding: '8px 18px', fontSize: '13px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
