import React, { useState } from 'react'
import './ParentShareModal.css'

/**
 * ParentShareModal Component
 *
 * Displays the shareable link for parents with quick action triggers:
 * Copy Link, Share on WhatsApp, Native Device Share, and View Parent Portal.
 *
 * @param {Object} props
 * @param {Object} props.pitch - The pitch or parent request object
 * @param {Function} props.onClose - Modal close handler
 * @param {Function} [props.notify] - Toast notification handler
 */
export default function ParentShareModal({ pitch, onClose, notify }) {
  const [copied, setCopied] = useState(false)

  if (!pitch) return null

  const token = pitch.shareToken || pitch.token
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173'
  const shareUrl = pitch.parentShareUrl || `${baseUrl}/parent/${token}`

  const pitchTitle = pitch.title || `₹${Number(pitch.amount || 0).toLocaleString('en-IN')} for ${pitch.purpose || 'money request'}`
  const shareText = `Hey! I made a money proposal on LOOT for ${pitchTitle}. You can review it, check my chores, and give your decision here (no account needed): ${shareUrl}`

  const handleCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl)
      } else {
        const input = document.getElementById('psm-share-url-input')
        if (input) {
          input.select()
          document.execCommand('copy')
        }
      }
      setCopied(true)
      if (notify) notify('Parent share link copied to clipboard!')
      setTimeout(() => setCopied(false), 2500)
    } catch {
      if (notify) notify('Please copy the link from the input box.')
    }
  }

  const handleWhatsAppShare = () => {
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `LOOT Pitch: ${pitchTitle}`,
          text: shareText,
          url: shareUrl
        })
      } catch {
        // User cancelled share
      }
    } else {
      handleCopy()
    }
  }

  const handleViewPortal = () => {
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="psm-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="psm-title">
      <div className="psm-card" onClick={e => e.stopPropagation()}>
        <button type="button" className="psm-close" onClick={onClose} aria-label="Close share dialog">
          ✕
        </button>

        <span className="psm-badge">✦ PARENT SHARE LINK ✦</span>
        <h2 id="psm-title" className="psm-title">Your request is ready to share!</h2>
        <p className="psm-subtitle">
          Send this passwordless link to your parent. They can review your proposal, see your committed chores, and record a decision on any phone or computer.
        </p>

        {/* Link Input Row */}
        <div className="psm-link-box">
          <input
            id="psm-share-url-input"
            className="psm-link-input"
            readOnly
            value={shareUrl}
            onClick={e => e.target.select()}
          />
          <button type="button" className="psm-copy-inline-btn" onClick={handleCopy}>
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {/* Actions Grid */}
        <div className="psm-actions-grid">
          <button type="button" className="psm-btn copy" onClick={handleCopy}>
            📋 Copy Link
          </button>

          <button type="button" className="psm-btn whatsapp" onClick={handleWhatsAppShare}>
            💬 WhatsApp
          </button>

          <button type="button" className="psm-btn share" onClick={handleNativeShare}>
            📱 Native Share
          </button>

          <button type="button" className="psm-btn portal" onClick={handleViewPortal}>
            👁 View Portal
          </button>
        </div>

        <p className="psm-notice">
          Parents do not need an account or password. Anyone with this unique link can view this request. Link expires in 7 days.
        </p>
      </div>
    </div>
  )
}
