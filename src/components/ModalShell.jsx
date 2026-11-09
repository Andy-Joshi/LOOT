import React from 'react'

/**
 * Reusable modal shell with backdrop, close button, kicker, and title.
 */
export default function ModalShell({ title, kicker, closeModal, children, className = '' }) {
  return (
    <div className={`modal-backdrop ${className ? `${className}-backdrop` : ''}`} onClick={closeModal}>
      <div className={`modal ${className}`} onClick={event => event.stopPropagation()}>
        <button className="close-modal" onClick={closeModal} aria-label="Close modal">×</button>
        {kicker && <span className="section-kicker">{kicker}</span>}
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  )
}
