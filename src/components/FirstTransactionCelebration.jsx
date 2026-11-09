import React, { useState, useEffect, useCallback } from 'react'
import './FirstTransactionCelebration.css'

function createSparks() {
  const sparks = []
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    const r = 90 + Math.random() * 60
    const z = 5 + Math.random() * 5
    sparks.push({
      id: `${i}-${Date.now()}-${Math.random()}`,
      width: z,
      height: z,
      dx: `${Math.cos(a) * r}px`,
      dy: `${Math.sin(a) * r}px`
    })
  }
  return sparks
}

export function FirstTransactionCelebration({
  isOpen = true,
  onClose,
  transaction,
  standalone = false,
  onReplay
}) {
  const [playKey, setPlayKey] = useState(0)
  const [sparks, setSparks] = useState(createSparks)

  const handleReplay = useCallback(() => {
    setSparks(createSparks())
    setPlayKey(k => k + 1)
    if (onReplay) onReplay()
  }, [onReplay])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen || standalone) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && onClose) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, standalone, onClose])

  if (!isOpen && !standalone) return null

  const formattedAmount = transaction?.amount != null
    ? Math.abs(Number(transaction.amount)).toLocaleString('en-IN')
    : null

  const content = (
    <div
      className={`first-tx-card ${standalone ? 'standalone' : ''}`}
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal={!standalone}
      aria-label="First transaction logged celebration"
    >
      {!standalone && onClose && (
        <button
          className="first-tx-close"
          onClick={onClose}
          aria-label="Close celebration"
        >
          ×
        </button>
      )}

      <span className="first-tx-kicker">
        {transaction?.isFirst ? '✦ Milestone Unlocked ✦' : '✦ Transaction Lodged ✦'}
      </span>

      <h2 className="first-tx-title">
        {transaction?.isFirst ? 'First Transaction Logged!' : 'Transaction Lodged!'}
      </h2>

      {transaction ? (
        <div className="first-tx-meta-chip">
          <span>{transaction.title || 'Expense Record'}</span>
          {formattedAmount && (
            <>
              <span>•</span>
              <strong>₹{formattedAmount}</strong>
            </>
          )}
          <span>•</span>
          <span style={{ color: 'var(--green)' }}>+2 ✦</span>
        </div>
      ) : (
        <p className="first-tx-subtitle">
          Your receipt is verified and recorded into your personal ledger.
        </p>
      )}

      <div className="first-tx-stage" id="stage">
        <svg
          key={playKey}
          className="first-tx-svg"
          viewBox="0 0 400 500"
          role="img"
          aria-label="Receipt with green checkmark"
        >
          <g className="rc">
            <path
              d="M322,62 L350,85 L362,440 L322,440Z"
              fill="#20241f"
              stroke="#2c3a2a"
              strokeWidth="2"
            />
            <g className="paper">
              <path
                d="M90,70 L310,62 L322,440 L302,454 L282,442 L262,456 L242,444 L222,458 L202,446 L182,460 L162,448 L142,462 L122,450 L102,464Z"
                fill="#1d201d"
                stroke="#0b0b0b"
                strokeWidth="8"
                strokeLinejoin="round"
              />
              <path
                d="M98,78 L304,71 L314,436 L110,452Z"
                fill="none"
                stroke="#8aa49a"
                strokeWidth="2"
                opacity=".6"
              />
              <rect
                x="112"
                y="100"
                width="170"
                height="3"
                fill="#9aa"
                opacity=".7"
                transform="rotate(-2 200 100)"
              />
              <rect
                x="100"
                y="125"
                width="210"
                height="75"
                fill="#6f8a85"
                opacity=".45"
                transform="rotate(-2 200 160)"
              />
              <rect
                x="108"
                y="260"
                width="205"
                height="45"
                fill="#6f8a85"
                opacity=".45"
                transform="rotate(-2 200 280)"
              />
              <rect
                x="108"
                y="395"
                width="205"
                height="45"
                fill="#6f8a85"
                opacity=".45"
                transform="rotate(-2 200 410)"
              />
              <rect className="scan" x="100" y="120" width="215" height="6" fill="#7dff6a" />
              <g className="dollar d1" fill="#5fd34a">
                <rect x="136" y="132" width="8" height="52" />
                <rect x="122" y="140" width="34" height="9" />
                <rect x="122" y="154" width="34" height="9" />
                <rect x="122" y="168" width="34" height="9" />
              </g>
              <g className="dollar d2" fill="#5fd34a">
                <rect x="268" y="130" width="8" height="52" />
                <rect x="254" y="138" width="34" height="9" />
                <rect x="254" y="152" width="34" height="9" />
                <rect x="254" y="166" width="34" height="9" />
              </g>
              <g className="pop">
                <path className="chk2" pathLength="1" d="M150,300 L195,345 L280,250" />
                <path className="chk" pathLength="1" d="M150,300 L195,345 L280,250" />
              </g>
            </g>
          </g>
          <g id="sparks">
            {sparks.map(s => (
              <rect
                key={s.id}
                className="sp"
                x={255}
                y={280}
                width={s.width}
                height={s.height}
                style={{ '--x': s.dx, '--y': s.dy }}
              />
            ))}
          </g>
        </svg>
      </div>

      <div className="first-tx-actions">
        <button
          type="button"
          id="replay"
          className="first-tx-replay-btn"
          onClick={handleReplay}
        >
          ↺ Replay
        </button>
        {!standalone && onClose && (
          <button
            type="button"
            className="first-tx-continue-btn"
            onClick={onClose}
          >
            Continue to LOOT →
          </button>
        )}
      </div>
    </div>
  )

  if (standalone) {
    return content
  }

  return (
    <div className="first-tx-backdrop" onClick={onClose}>
      {content}
    </div>
  )
}

export default FirstTransactionCelebration
