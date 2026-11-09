import React, { useEffect, useState } from 'react'
import './CoinFlyingEffect.css'

/**
 * CoinFlyingEffect Component
 *
 * Spawns animated 3D neon coins that burst outward from a source origin
 * and fly across the screen into the header coin counter with a pulse.
 *
 * @param {Object} props
 * @param {Array<{ id: string, startX: number, startY: number, count?: number }>} props.bursts
 * @param {Function} props.onCoinsLanded - Callback fired when coins reach the counter
 */
export default function CoinFlyingEffect({ bursts = [], onCoinsLanded }) {
  const [activeParticles, setActiveParticles] = useState([])

  useEffect(() => {
    if (!bursts || bursts.length === 0) return

    const latestBurst = bursts[bursts.length - 1]
    if (!latestBurst) return

    // Find destination target (topbar coin badge or user chip)
    const targetElement =
      document.getElementById('header-coin-counter') ||
      document.querySelector('.user-chip') ||
      { getBoundingClientRect: () => ({ left: window.innerWidth - 140, top: 25, width: 30, height: 30 }) }

    const targetRect = targetElement.getBoundingClientRect()
    const endX = targetRect.left + targetRect.width / 2
    const endY = targetRect.top + targetRect.height / 2

    const startX = latestBurst.startX || window.innerWidth / 2
    const startY = latestBurst.startY || window.innerHeight / 2

    const particleCount = Math.min(8, Math.max(4, latestBurst.count || 6))
    const newParticles = []

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() * 0.4 - 0.2)
      const distance = 40 + Math.random() * 60

      newParticles.push({
        id: `${latestBurst.id}-${i}-${Math.random()}`,
        startX,
        startY,
        scatterX: Math.cos(angle) * distance,
        scatterY: Math.sin(angle) * distance,
        endX,
        endY,
        delay: i * 0.04
      })
    }

    setActiveParticles(prev => [...prev, ...newParticles])

    // Trigger header pulse & count up when coins land (~850ms)
    const landTimer = setTimeout(() => {
      if (onCoinsLanded) onCoinsLanded()
      const pulseTarget = document.getElementById('header-coin-counter')
      if (pulseTarget) {
        pulseTarget.classList.remove('header-coin-pulse')
        void pulseTarget.offsetWidth
        pulseTarget.classList.add('header-coin-pulse')
        setTimeout(() => pulseTarget.classList.remove('header-coin-pulse'), 500)
      }
    }, 850)

    // Cleanup particles from DOM
    const cleanupTimer = setTimeout(() => {
      setActiveParticles(prev => prev.filter(p => !newParticles.some(np => np.id === p.id)))
    }, 1100)

    return () => {
      clearTimeout(landTimer)
      clearTimeout(cleanupTimer)
    }
  }, [bursts, onCoinsLanded])

  if (activeParticles.length === 0) return null

  return (
    <div className="coin-flying-container" aria-hidden="true">
      {activeParticles.map(p => (
        <div
          key={p.id}
          className="flying-coin-particle"
          style={{
            '--start-x': `${p.startX}px`,
            '--start-y': `${p.startY}px`,
            '--scatter-x': `${p.scatterX}px`,
            '--scatter-y': `${p.scatterY}px`,
            '--end-x': `${p.endX}px`,
            '--end-y': `${p.endY}px`,
            animationDelay: `${p.delay}s`
          }}
        >
          <div className="coin-particle-inner">✦</div>
        </div>
      ))}
    </div>
  )
}
