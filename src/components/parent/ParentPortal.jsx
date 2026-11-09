import React, { useState, useEffect, useCallback } from 'react'
import LootLogo from '../LootLogo'
import './ParentPortal.css'

/**
 * Public Passwordless Parent Portal Component (/parent/:token)
 *
 * Allows parents to review their teen's money proposal, inspect chores/commitments,
 * and submit an official decision (Approve, Decline, Request Changes) with an optional note.
 *
 * @param {Object} props
 * @param {string} props.token - Cryptographically secure share token from URL
 */
export default function ParentPortal({ token }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [request, setRequest] = useState(null)
  const [selectedDecision, setSelectedDecision] = useState('')
  const [parentMessage, setParentMessage] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const fetchRequest = useCallback(async () => {
    if (!token) {
      setError('No share link token was provided.')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const res = await fetch(`/api/parent-requests/token/${encodeURIComponent(token)}`)
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to load request.')
        setLoading(false)
        return
      }

      setRequest(data)
      setError(null)
    } catch (err) {
      setError('Unable to connect to the LOOT server. Please check your internet connection.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchRequest()
  }, [fetchRequest])

  const handleConfirmDecision = async () => {
    if (!selectedDecision || submitting) return

    try {
      setSubmitting(true)
      const res = await fetch(`/api/parent-requests/token/${encodeURIComponent(token)}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: selectedDecision,
          message: parentMessage.trim()
        })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to submit decision.')
        setShowConfirm(false)
        setSubmitting(false)
        return
      }

      setRequest(data.request)
      setSubmitSuccess(true)
      setShowConfirm(false)
    } catch {
      alert('Network error while submitting decision. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="parent-portal-page" role="main" aria-label="LOOT Parent Portal">
        <div className="parent-portal-container">
          <div className="parent-portal-header">
            <LootLogo intro={false} showWordmark={true} size="md" />
            <span className="parent-portal-badge">✦ PARENT PORTAL ✦</span>
            <h1>Loading Proposal...</h1>
            <p>Retrieving your teen's request details.</p>
          </div>
        </div>
      </main>
    )
  }

  if (error || !request) {
    return (
      <main className="parent-portal-page" role="main" aria-label="LOOT Parent Portal">
        <div className="parent-portal-container">
          <div className="parent-portal-header">
            <LootLogo intro={false} showWordmark={true} size="md" />
            <span className="parent-portal-badge">✦ PARENT PORTAL ✦</span>
            <h1>Link Unavailable</h1>
            <p style={{ color: '#ff7da4' }}>{error || 'Request could not be found.'}</p>
          </div>
          <div className="parent-request-card" style={{ textAlign: 'center', padding: '30px' }}>
            <p style={{ margin: '0 0 16px', color: '#9cb09f', fontSize: '14px' }}>
              This parent link may have expired (links are valid for 7 days) or was cancelled by the teen.
            </p>
            <a
              href="/"
              className="parent-submit-btn"
              style={{ display: 'inline-block', textDecoration: 'none', maxWidth: '200px', margin: '0 auto' }}
            >
              Open LOOT
            </a>
          </div>
        </div>
      </main>
    )
  }

  const isPending = request.status === 'pending'
  const createdDate = request.created_at ? new Date(request.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recently'
  const expiresDate = request.expires_at ? new Date(request.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'In 7 days'
  const tasks = request.metadata?.tasks || []

  return (
    <main className="parent-portal-page" role="main" aria-label="LOOT Parent Portal">
      <div className="parent-portal-container">
        {/* Header */}
        <header className="parent-portal-header">
          <LootLogo intro={false} showWordmark={true} size="md" />
          <span className="parent-portal-badge">✦ PARENT DECISION PORTAL ✦</span>
          <h1>Teen Money Proposal</h1>
          <p>
            Review what your teen is saving or asking for, inspect their promised chores, and record your decision.
          </p>
        </header>

        {/* Request Details Card */}
        <section className="parent-request-card" aria-labelledby="portal-req-title">
          <div className="parent-card-top">
            <div>
              <span className="parent-card-kicker">MONEY REQUEST</span>
              <h2 id="portal-req-title" className="parent-request-title">{request.title}</h2>
            </div>
            <span className={`parent-status-pill ${request.status}`}>
              {request.status.replace('_', ' ')}
            </span>
          </div>

          {request.requested_amount !== null && (
            <div className="parent-amount-row">
              <span className="parent-amount-label">REQUESTED AMOUNT:</span>
              <strong className="parent-amount-val">
                ₹{Number(request.requested_amount).toLocaleString('en-IN')}
              </strong>
            </div>
          )}

          {request.description && (
            <div className="parent-description-box">
              <span className="parent-label">TEEN'S EXPLANATION</span>
              <p className="parent-reason-text">{request.description}</p>
            </div>
          )}

          {/* Chores & Commitments */}
          {Array.isArray(tasks) && tasks.length > 0 && (
            <div className="parent-chores-card">
              <div className="parent-chores-head">
                <span className="parent-chores-kicker">COMMITTED CHORES ({tasks.length})</span>
                <small style={{ color: '#8da28f', fontSize: '11px' }}>Earns LOOT coins when done</small>
              </div>
              <div className="parent-chores-list">
                {tasks.map((task, idx) => (
                  <div className="parent-chore-item" key={idx}>
                    <strong className="parent-chore-title">• {task.title}</strong>
                    {task.duration && (
                      <span className="parent-chore-duration">{task.duration}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="parent-meta-strip">
            <span>Sent: <strong>{createdDate}</strong></span>
            <span>Link Expiry: <strong>{expiresDate}</strong></span>
          </div>
        </section>

        {/* Decision Section (if Pending) */}
        {isPending ? (
          <section className="parent-decision-section" aria-label="Parent Response Actions">
            <h3 className="parent-decision-title">Record Your Decision</h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#9cb09f' }}>
              Choose a decision below and optionally leave a note for your teen:
            </p>

            <div className="parent-decision-buttons">
              <button
                type="button"
                className={`parent-choice-btn ${selectedDecision === 'approved' ? 'selected-approve' : ''}`}
                onClick={() => setSelectedDecision('approved')}
              >
                <span className="parent-choice-icon">✓</span>
                <span>Approve</span>
              </button>

              <button
                type="button"
                className={`parent-choice-btn ${selectedDecision === 'declined' ? 'selected-decline' : ''}`}
                onClick={() => setSelectedDecision('declined')}
              >
                <span className="parent-choice-icon">✗</span>
                <span>Decline</span>
              </button>

              <button
                type="button"
                className={`parent-choice-btn ${selectedDecision === 'changes_requested' ? 'selected-changes' : ''}`}
                onClick={() => setSelectedDecision('changes_requested')}
              >
                <span className="parent-choice-icon">💬</span>
                <span>Request Changes</span>
              </button>
            </div>

            <div className="parent-note-wrap">
              <label htmlFor="parent-message-input" className="parent-label">
                OPTIONAL MESSAGE TO TEEN
              </label>
              <textarea
                id="parent-message-input"
                className="parent-note-input"
                value={parentMessage}
                onChange={e => setParentMessage(e.target.value)}
                placeholder="e.g. Looks good! Complete Saturday chores first and we will talk."
                maxLength={500}
              />
            </div>

            <button
              type="button"
              className="parent-submit-btn"
              disabled={!selectedDecision || submitting}
              onClick={() => setShowConfirm(true)}
            >
              Continue to Confirm →
            </button>
          </section>
        ) : (
          /* Already Decided Banner */
          <section className={`parent-result-card ${request.status}`} aria-label="Recorded Decision">
            <h3>
              {request.status === 'approved' && '✓ Proposal Approved'}
              {request.status === 'declined' && '✗ Proposal Declined'}
              {request.status === 'changes_requested' && '💬 Changes Requested'}
              {request.status === 'expired' && '⏳ Link Expired'}
              {request.status === 'revoked' && '🚫 Request Cancelled by Teen'}
            </h3>
            <p>
              Decision recorded on{' '}
              {request.responded_at
                ? new Date(request.responded_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                : 'file'}. Your teen has been notified in their LOOT app.
            </p>
            {request.parent_message && (
              <div className="parent-note-bubble">
                "{request.parent_message}"
              </div>
            )}
          </section>
        )}

        {/* Confirmation Modal */}
        {showConfirm && (
          <div className="parent-confirm-overlay" role="dialog" aria-modal="true" aria-labelledby="confirm-decision-title">
            <div className="parent-confirm-modal">
              <h3 id="confirm-decision-title" className="parent-confirm-title">
                Confirm Decision: {selectedDecision.replace('_', ' ').toUpperCase()}
              </h3>
              <p className="parent-confirm-desc">
                You are about to record this response for <strong>{request.title}</strong>.
                {parentMessage && <span> Your note will be delivered to your teen.</span>}
              </p>

              <div className="parent-disclaimer-box">
                <strong>Important Notice:</strong> Your decision is recorded in LOOT for financial planning and habit tracking. LOOT does not initiate bank transfers or automatic purchases.
              </div>

              <div className="parent-confirm-actions">
                <button
                  type="button"
                  className="parent-confirm-btn cancel"
                  onClick={() => setShowConfirm(false)}
                  disabled={submitting}
                >
                  Back to Review
                </button>
                <button
                  type="button"
                  className={`parent-confirm-btn confirm-${selectedDecision === 'approved' ? 'approve' : selectedDecision === 'declined' ? 'decline' : 'changes'}`}
                  onClick={handleConfirmDecision}
                  disabled={submitting}
                >
                  {submitting ? 'Recording...' : 'Confirm & Send'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer / Privacy note */}
        <footer className="parent-portal-footer">
          <p>
            <strong>LOOT Parent Share Link</strong> — Passwordless link-based approval.
            Anyone with this link can view this request and record a decision.
          </p>
          <p>© 2026 LOOT. Gamified financial literacy for teens.</p>
        </footer>
      </div>
    </main>
  )
}
