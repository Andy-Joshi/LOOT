import React from 'react'
import LootCoin from './LootCoin'
import CoinBadge from './CoinBadge'

export function TransactionModal({ transaction, onClose }) {
  if (!transaction) return null

  const isEarn = transaction.type === 'earn'
  const isSpend = transaction.type === 'spend'

  const formattedDate = transaction.timestamp
    ? new Date(transaction.timestamp).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'Recent'

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal tx-modal" onClick={e => e.stopPropagation()}>
        <button className="close-modal" onClick={onClose} aria-label="Close">×</button>

        <div className="tx-modal-header">
          <div className="tx-modal-icon-wrap">
            <span className={`tx-large-icon ${transaction.type}`}>
              {isEarn ? '↗' : isSpend ? '↘' : '↺'}
            </span>
          </div>
          <div>
            <span className="section-kicker">LEDGER RECORD</span>
            <h2>{transaction.title}</h2>
            <div className="tx-modal-badges">
              <span className={`category-pill ${transaction.category || 'general'}`}>
                {(transaction.category || 'general').toUpperCase()}
              </span>
              <span className={`type-pill ${transaction.type}`}>
                {transaction.type.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div className="tx-amount-display">
          <span className="tx-amount-label">Coin Flow</span>
          <CoinBadge
            amount={transaction.amount}
            prefix={isEarn ? '+' : isSpend ? '-' : '↺'}
            size="lg"
            variant={isEarn ? 'lime' : isSpend ? 'pink' : 'yellow'}
            glow
          />
        </div>

        <div className="tx-details-grid">
          <div className="tx-detail-item">
            <label>Transaction ID</label>
            <code>{transaction.id}</code>
          </div>

          <div className="tx-detail-item">
            <label>Timestamp</label>
            <span>{formattedDate}</span>
          </div>

          <div className="tx-detail-item">
            <label>Balance After</label>
            <span className="tx-balance-val">
              <LootCoin size="xs" /> {Number(transaction.balanceAfter || 0).toLocaleString('en-IN')} Coins
            </span>
          </div>

          <div className="tx-detail-item">
            <label>Source Subsystem</label>
            <span>{transaction.source || 'system'}</span>
          </div>

          {transaction.referenceId && (
            <div className="tx-detail-item full-width">
              <label>Reference Identifier</label>
              <code className="ref-code">{transaction.referenceId}</code>
            </div>
          )}

          <div className="tx-detail-item full-width">
            <label>Description / Reason</label>
            <p className="tx-reason-text">{transaction.description || 'No description provided.'}</p>
          </div>
        </div>

        <div className="tx-integrity-badge">
          <span className="integrity-icon">✓</span>
          <div>
            <strong>Verified By LOOT Coin Engine</strong>
            <small>Immutable ledger entry · Duplicate-protected</small>
          </div>
        </div>

        <button className="primary-button full" onClick={onClose}>
          Close Inspection
        </button>
      </div>
    </div>
  )
}

export default TransactionModal
