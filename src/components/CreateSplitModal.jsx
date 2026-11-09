import React, { useState, useMemo } from 'react'
import ModalShell from './ModalShell'
import { distributeEqually, validateCustomSplit } from '../services/splitService'
import './CreateSplitModal.css'

/**
 * CreateSplitModal Component (Split Bills 2.0)
 *
 * Supports two splitting modes:
 * - Equal Distribution (penny-exact rounding, sum strictly equals bill total)
 * - Custom Distribution (individual amounts per participant with live unallocated balance & validation)
 *
 * @param {Object} props
 * @param {Function} props.closeModal - Modal dismissal handler
 * @param {Function} props.onCreateSplit - Callback returning the finalized split payload
 * @param {string} [props.defaultUserName='You'] - Default user / creator name
 */
export default function CreateSplitModal({
  closeModal,
  onCreateSplit,
  defaultUserName = 'You'
}) {
  const [title, setTitle] = useState('')
  const [total, setTotal] = useState('')
  const [mode, setMode] = useState('equal') // 'equal' | 'custom'

  // Equal mode participants (names)
  const [equalInput, setEqualInput] = useState(`${defaultUserName}, Riya, Sam`)

  // Custom mode participants: [{ id, name, amount }]
  const [customParticipants, setCustomParticipants] = useState([
    { id: '1', name: defaultUserName, amount: '' },
    { id: '2', name: 'Riya', amount: '' },
    { id: '3', name: 'Sam', amount: '' }
  ])

  const [formError, setFormError] = useState('')

  const numTotal = Number(total) || 0

  // Parse equal mode names
  const equalNames = useMemo(() => {
    return equalInput
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
  }, [equalInput])

  // Calculated equal shares
  const equalShares = useMemo(() => {
    if (numTotal <= 0 || equalNames.length === 0) return []
    return distributeEqually(numTotal, equalNames.length)
  }, [numTotal, equalNames.length])

  // Switch to custom mode: sync participant names and auto-distribute equal amounts initially
  const handleSwitchToCustom = () => {
    if (equalNames.length > 0) {
      const shares = numTotal > 0 ? distributeEqually(numTotal, equalNames.length) : []
      const synced = equalNames.map((name, i) => ({
        id: String(i + 1),
        name,
        amount: shares[i] !== undefined ? String(shares[i]) : ''
      }))
      setCustomParticipants(synced)
    }
    setMode('custom')
    setFormError('')
  }

  // Switch to equal mode: sync participant names
  const handleSwitchToEqual = () => {
    const names = customParticipants
      .map(p => p.name.trim())
      .filter(Boolean)
    if (names.length > 0) {
      setEqualInput(names.join(', '))
    }
    setMode('equal')
    setFormError('')
  }

  // Custom mode: Add participant row
  const handleAddCustomParticipant = () => {
    const nextId = String(Date.now())
    setCustomParticipants(prev => [...prev, { id: nextId, name: '', amount: '' }])
  }

  // Custom mode: Remove participant row
  const handleRemoveCustomParticipant = (id) => {
    if (customParticipants.length <= 1) return
    setCustomParticipants(prev => prev.filter(p => p.id !== id))
  }

  // Custom mode: Update participant field
  const handleUpdateCustomParticipant = (id, field, value) => {
    setCustomParticipants(prev =>
      prev.map(p => (p.id === id ? { ...p, [field]: value } : p))
    )
    setFormError('')
  }

  // Custom mode validation metrics
  const customValidation = useMemo(() => {
    if (mode !== 'custom') return { valid: true, allocatedTotal: 0, unallocated: 0 }
    return validateCustomSplit(numTotal, customParticipants)
  }, [mode, numTotal, customParticipants])

  // Quick helper: Distribute remaining balance equally among participants with empty or zero amounts
  const handleDistributeRemaining = () => {
    if (numTotal <= 0) return
    const unallocated = customValidation.unallocated
    if (unallocated <= 0) return

    const emptySlots = customParticipants.filter(p => !p.amount || Number(p.amount) === 0)
    const targets = emptySlots.length > 0 ? emptySlots : customParticipants
    const shares = distributeEqually(unallocated, targets.length)

    let shareIndex = 0
    setCustomParticipants(prev =>
      prev.map(p => {
        const isTarget = targets.some(t => t.id === p.id)
        if (isTarget && shareIndex < shares.length) {
          const currentVal = Number(p.amount) || 0
          const updatedAmt = Number((currentVal + shares[shareIndex]).toFixed(2))
          shareIndex++
          return { ...p, amount: String(updatedAmt) }
        }
        return p
      })
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    setFormError('')

    if (!title.trim()) {
      setFormError('Please enter what the bill was for.')
      return
    }

    if (numTotal <= 0) {
      setFormError('Please enter a valid bill total greater than ₹0.')
      return
    }

    let finalizedParticipants = []

    if (mode === 'equal') {
      if (equalNames.length === 0) {
        setFormError('Please enter at least one participant.')
        return
      }
      finalizedParticipants = equalNames.map((name, i) => ({
        id: `p_${Date.now()}_${i}`,
        name,
        amount: equalShares[i],
        paid: false
      }))
    } else {
      // Custom mode
      const validation = validateCustomSplit(numTotal, customParticipants)
      if (!validation.valid) {
        setFormError(validation.error || 'Total allocated amounts must equal bill total.')
        return
      }
      finalizedParticipants = customParticipants.map((p, i) => ({
        id: p.id || `p_${Date.now()}_${i}`,
        name: p.name.trim(),
        amount: Number(p.amount),
        paid: false
      }))
    }

    if (onCreateSplit) {
      onCreateSplit({
        title: title.trim(),
        total: numTotal,
        mode,
        participants: finalizedParticipants
      })
    }
  }

  return (
    <ModalShell title="Create a split bill" kicker="SPLIT BILLS 2.0" closeModal={closeModal}>
      <form onSubmit={handleSubmit} className="split-modal-form">
        {/* Bill Title */}
        <div className="split-field">
          <label htmlFor="split-title">What was it for?</label>
          <input
            id="split-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Dinner at Social, Weekend AirBnB"
            autoFocus
          />
        </div>

        {/* Bill Total Amount */}
        <div className="split-field">
          <label htmlFor="split-total">Total Bill Amount</label>
          <div className="split-currency-input-wrap">
            <span className="split-currency-prefix">₹</span>
            <input
              id="split-total"
              required
              type="number"
              min="1"
              step="any"
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        {/* Two-State Distribution Mode Segmented Control */}
        <div className="split-mode-selector">
          <label className="split-mode-label">Distribution Mode</label>
          <div className="split-mode-toggle" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'equal'}
              className={`split-mode-btn ${mode === 'equal' ? 'active' : ''}`}
              onClick={handleSwitchToEqual}
            >
              ➗ Equal Distribution
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'custom'}
              className={`split-mode-btn ${mode === 'custom' ? 'active' : ''}`}
              onClick={handleSwitchToCustom}
            >
              ✎ Custom Distribution
            </button>
          </div>
        </div>

        {/* MODE A: EQUAL DISTRIBUTION */}
        {mode === 'equal' && (
          <div className="split-mode-body">
            <div className="split-field">
              <label htmlFor="split-equal-names">Participants (comma separated)</label>
              <input
                id="split-equal-names"
                required
                value={equalInput}
                onChange={(e) => setEqualInput(e.target.value)}
                placeholder="Andy, Riya, Sam"
              />
            </div>

            {/* Live Equal Distribution Preview */}
            {numTotal > 0 && equalNames.length > 0 && (
              <div className="equal-preview-card">
                <div className="equal-preview-header">
                  <span>EQUAL DISTRIBUTION PREVIEW</span>
                  <strong>{equalNames.length} participants</strong>
                </div>
                <div className="equal-preview-chips">
                  {equalNames.map((name, i) => (
                    <div key={`${name}-${i}`} className="equal-preview-chip">
                      <span className="equal-chip-name">{name}</span>
                      <strong className="equal-chip-amt">₹{equalShares[i]}</strong>
                    </div>
                  ))}
                </div>
                <div className="equal-preview-footer">
                  <small>
                    Total distributed: ₹{equalShares.reduce((s, a) => s + a, 0).toFixed(2)} of ₹{numTotal.toFixed(2)}
                  </small>
                  <span className="equal-exact-badge">✓ Exact sum</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* MODE B: CUSTOM DISTRIBUTION */}
        {mode === 'custom' && (
          <div className="split-mode-body">
            <div className="custom-participants-header">
              <span>PARTICIPANTS & ALLOCATED AMOUNTS</span>
              {customValidation.unallocated > 0 && (
                <button
                  type="button"
                  className="distribute-rem-btn"
                  onClick={handleDistributeRemaining}
                  title="Distribute remaining unallocated amount"
                >
                  ＋ Fill Remaining (₹{customValidation.unallocated})
                </button>
              )}
            </div>

            <div className="custom-participants-list">
              {customParticipants.map((p, idx) => (
                <div key={p.id} className="custom-participant-row">
                  <span className="row-index">#{idx + 1}</span>
                  <input
                    type="text"
                    required
                    placeholder="Participant Name"
                    className="custom-name-input"
                    value={p.name}
                    onChange={(e) => handleUpdateCustomParticipant(p.id, 'name', e.target.value)}
                  />
                  <div className="custom-amt-wrap">
                    <span className="amt-prefix">₹</span>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      required
                      placeholder="0"
                      className="custom-amt-input"
                      value={p.amount}
                      onChange={(e) => handleUpdateCustomParticipant(p.id, 'amount', e.target.value)}
                    />
                  </div>
                  {customParticipants.length > 1 && (
                    <button
                      type="button"
                      className="remove-row-btn"
                      onClick={() => handleRemoveCustomParticipant(p.id)}
                      title="Remove participant"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              type="button"
              className="add-participant-btn"
              onClick={handleAddCustomParticipant}
            >
              ＋ Add Participant
            </button>

            {/* Custom Allocation Balance Bar */}
            <div className={`custom-balance-bar ${customValidation.valid ? 'valid' : 'invalid'}`}>
              <div className="balance-info-col">
                <span>Allocated:</span>
                <strong>₹{customValidation.allocatedTotal.toLocaleString('en-IN')} / ₹{numTotal.toLocaleString('en-IN')}</strong>
              </div>
              <div className="balance-status-col">
                {customValidation.valid ? (
                  <span className="balance-badge exact">✓ 100% Balanced</span>
                ) : customValidation.unallocated > 0 ? (
                  <span className="balance-badge remaining">
                    ₹{customValidation.unallocated.toLocaleString('en-IN')} unallocated
                  </span>
                ) : (
                  <span className="balance-badge over">
                    ₹{Math.abs(customValidation.unallocated).toLocaleString('en-IN')} over limit
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Validation Error Banner */}
        {formError && <p className="split-form-error">{formError}</p>}

        {/* Submit Button */}
        <button
          className="primary-button full split-submit-btn"
          type="submit"
          disabled={mode === 'custom' && !customValidation.valid}
        >
          Create Split Bill · Track Settlements
        </button>

        <p className="split-reward-hint">
          ✦ Settle this bill with your crew to earn a <strong>+25 LOOT Coins</strong> reward!
        </p>
      </form>
    </ModalShell>
  )
}
