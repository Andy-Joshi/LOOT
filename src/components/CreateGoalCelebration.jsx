import React, { useState, useEffect, useRef, useId, useCallback } from 'react'
import './CreateGoalCelebration.css'

const COLS = ['#67ff3a', '#b9ff6a', '#8a4dff', '#c9a8ff', '#fff']

const DEFAULT_L1 = [
  { c: 'C', x: 133, y: 285, i: 0 },
  { c: 'r', x: 157, y: 285, i: 1 },
  { c: 'e', x: 171, y: 285, i: 2 },
  { c: 'a', x: 189, y: 285, i: 3 },
  { c: 't', x: 207, y: 285, i: 4 },
  { c: 'e', x: 219, y: 285, i: 5 },
  { c: 'a', x: 247, y: 285, i: 7 }
]

const DEFAULT_L2 = [
  { c: 'G', x: 147, y: 322, i: 8 },
  { c: 'o', x: 183, y: 322, i: 9 },
  { c: 'a', x: 209, y: 322, i: 10 },
  { c: 'l', x: 235, y: 322, i: 11 }
]

/**
 * Generate confetti particles from the plus button origin (258, 220)
 */
function createConfettiBurst(delay = 0, count = 30) {
  const particles = []
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 40 + Math.random() * 95
    const isCircle = Math.random() < 0.35
    const z = 3 + Math.random() * 5
    particles.push({
      id: Math.random().toString(36).slice(2, 9),
      isCircle,
      x: 258,
      y: 220,
      width: isCircle ? 0 : z,
      height: isCircle ? 0 : z * (Math.random() < 0.5 ? 1 : 2.2),
      radius: isCircle ? z / 2 : 0,
      fill: COLS[i % COLS.length],
      targetX: Math.cos(a) * r,
      targetY: Math.sin(a) * r - 30,
      targetR: Math.random() * 540 - 270,
      delay
    })
  }
  return particles
}

/**
 * CreateGoalCelebration Component
 *
 * Full animated celebration triggered whenever a user creates a new savings goal.
 * Faithfully ports the "Create a Goal animation" HTML with Poppins typography,
 * interactive plus button, comets, cycling rows, and celebratory confetti.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether celebration modal is open
 * @param {Object} [props.goal] - The newly created goal data
 * @param {Function} props.onClose - Dismiss callback
 */
export default function CreateGoalCelebration({ isOpen, goal, onClose }) {
  const rawId = useId()
  const p = `cg-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-`
  const svgRef = useRef(null)

  const [animKey, setAnimKey] = useState(0)
  const [confetti, setConfetti] = useState(() => createConfettiBurst(2.05, 30))
  const [isHit, setIsHit] = useState(false)
  const [measuredLetters, setMeasuredLetters] = useState(null)

  // Measure letter positions dynamically if Poppins font is loaded in browser
  useEffect(() => {
    if (!isOpen) return

    const measure = () => {
      const svg = svgRef.current
      if (!svg) return

      try {
        const NS = 'http://www.w3.org/2000/svg'

        // Measure 'Create a'
        const t1 = document.createElementNS(NS, 'text')
        t1.setAttribute('class', 'cga-t1')
        t1.style.font = "italic 800 34px/1 'Poppins', system-ui, sans-serif"
        t1.textContent = 'Create a'
        svg.appendChild(t1)
        const tot1 = t1.getComputedTextLength()
        const pos1 = [...'Create a'].map((_, i) => t1.getStartPositionOfChar(i).x)
        t1.remove()

        // Measure 'Goal'
        const t2 = document.createElementNS(NS, 'text')
        t2.setAttribute('class', 'cga-t2')
        t2.style.font = "italic 800 46px/1 'Poppins', system-ui, sans-serif"
        t2.textContent = 'Goal'
        svg.appendChild(t2)
        const tot2 = t2.getComputedTextLength()
        const pos2 = [...'Goal'].map((_, i) => t2.getStartPositionOfChar(i).x)
        t2.remove()

        if (tot1 > 10 && tot2 > 10) {
          setMeasuredLetters({
            l1: [...'Create a']
              .map((c, i) => (c === ' ' ? null : { c, x: 199 - tot1 / 2 + pos1[i], y: 285, i }))
              .filter(Boolean),
            l2: [...'Goal'].map((c, i) => ({ c, x: 205 - tot2 / 2 + pos2[i], y: 322, i: 8 + i }))
          })
        }
      } catch {
        // Fallback to pre-calculated positions
      }
    }

    // Try measuring, race with font load
    if (document.fonts?.load) {
      document.fonts.load("italic 800 34px Poppins").then(measure, measure)
    } else {
      measure()
    }
  }, [isOpen, animKey])

  // Burst new confetti and hit bounce on plus button click
  const handlePlusClick = useCallback(() => {
    setIsHit(true)
    const newBurst = createConfettiBurst(0, 24)
    setConfetti(current => [...current.slice(-15), ...newBurst])
    const timer = setTimeout(() => setIsHit(false), 550)
    return () => clearTimeout(timer)
  }, [])

  // Auto replay entrance sequence
  const handleReplay = useCallback(() => {
    setAnimKey(k => k + 1)
    setConfetti(createConfettiBurst(2.05, 30))
    setIsHit(false)
  }, [])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const letters1 = measuredLetters?.l1 || DEFAULT_L1
  const letters2 = measuredLetters?.l2 || DEFAULT_L2

  const goalName = goal?.name || 'New Savings Mission'
  const goalTarget = Number(goal?.target) || 0
  const goalCategory = goal?.category || 'Savings'

  return (
    <div
      className="goal-celebration-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Create a Goal Celebration"
    >
      <div className="goal-celebration-modal" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="goal-celebration-close"
          onClick={onClose}
          title="Close celebration"
        >
          ×
        </button>

        <div className="goal-celebration-stage">
          <svg
            key={animKey}
            ref={svgRef}
            className="goal-celebration-svg"
            viewBox="70 50 260 310"
            role="img"
            aria-label="Create a Goal celebration animation"
            style={{ '--d': '3.6s' }}
          >
            <defs>
              <linearGradient id={`${p}rg`} gradientUnits="userSpaceOnUse" x1="-107" x2="107">
                <stop offset="0" stopColor="#8a4dff" />
                <stop offset="1" stopColor="#67ff3a" />
              </linearGradient>

              <linearGradient id={`${p}ce`} gradientUnits="userSpaceOnUse" x1="-80" y1="80" x2="80" y2="-80">
                <stop offset="0" stopColor="#7dff3a" />
                <stop offset=".55" stopColor="#5fb87a" />
                <stop offset="1" stopColor="#8a4dff" />
              </linearGradient>

              <linearGradient id={`${p}cb2`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#0b3414" />
                <stop offset=".6" stopColor="#0a1810" />
                <stop offset="1" stopColor="#1a0f40" />
              </linearGradient>

              <linearGradient id={`${p}bg`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#67ff3a" />
                <stop offset="1" stopColor="#8a4dff" />
              </linearGradient>

              <linearGradient id={`${p}tg`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#c8ff7a" />
                <stop offset="1" stopColor="#39f02a" />
              </linearGradient>

              <linearGradient id={`${p}sg`} x1="0" x2="1">
                <stop offset="0" stopColor="#39f02a" stopOpacity=".2" />
                <stop offset=".6" stopColor="#9dff6a" />
                <stop offset="1" stopColor="#39f02a" />
              </linearGradient>

              <radialGradient id={`${p}hg`}>
                <stop offset="0" stopColor="#67ff3a" stopOpacity=".22" />
                <stop offset=".55" stopColor="#8a4dff" stopOpacity=".16" />
                <stop offset="1" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Glowing Halo */}
            <circle className="cga-halo" cx="200" cy="175" r="130" fill={`url(#${p}hg)`} />

            <g className="cga-shake">
              <g className="cga-mark">
                {/* Back Ring Segment & Back Comet */}
                <g transform="translate(198 167) rotate(-17)">
                  <path className="cga-ring" pathLength="1" d="M-107 0A107 33 0 0 1 107 0" style={{ stroke: `url(#${p}rg)` }} />
                  <path className="cga-cm cga-cb" pathLength="1" d="M107 0A107 33 0 0 0 -107 0" />
                </g>

                {/* Central Floating Goal Checklist Clipboard */}
                <g transform="translate(191 168) rotate(-6)">
                  <g className="cga-cin">
                    <g className="cga-cfl">
                      {/* Shadow & Backplate */}
                      <rect x="-74" y="-76" width="156" height="160" rx="24" fill="#05140a" stroke="#1e6a2a" strokeWidth="3" opacity=".8" />
                      <rect x="-78" y="-80" width="156" height="160" rx="24" fill={`url(#${p}cb2)`} stroke={`url(#${p}ce)`} strokeWidth="4" />

                      {/* Top Clipboard Tab & Binder Clip */}
                      <g className="cga-tab">
                        <rect x="-34" y="-98" width="68" height="30" rx="10" fill="#0a2a12" stroke={`url(#${p}ce)`} strokeWidth="3.5" />
                        <rect x="-16" y="-110" width="32" height="16" rx="7" fill="#0a2a12" stroke="#67ff3a" strokeWidth="3" />
                      </g>

                      {/* Row 1: Completed green check */}
                      <g className="cga-row" style={{ '--i': 0 }}>
                        <rect x="-45" y="-48" width="26" height="26" rx="7" fill="#0f3a1a" stroke="#7dff5a" strokeWidth="3" />
                        <path className="cga-chk cga-k1" pathLength="1" d="M-39 -35L-34 -30L-25 -40" />
                        <rect className="cga-bar" style={{ '--i': 0 }} x="-11" y="-45" width="61" height="5" rx="2.5" fill="#6a56c8" />
                        <rect className="cga-bar" style={{ '--i': 0 }} x="-9" y="-32" width="38" height="5" rx="2.5" fill="#6a56c8" />
                      </g>

                      {/* Row 2: Cycling purple checkbox & bar */}
                      <g className="cga-row" style={{ '--i': 1 }}>
                        <rect className="cga-bx2" x="-39" y="-13" width="26" height="26" rx="7" fill="#12102a" stroke="#7a63d8" strokeWidth="3" />
                        <path className="cga-chk cga-k2" pathLength="1" d="M-33 0L-28 5L-19 -5" />
                        <rect className="cga-bar" style={{ '--i': 1 }} x="-4" y="-10" width="60" height="5" rx="2.5" fill="#6a56c8" />
                        <rect className="cga-bar" style={{ '--i': 1 }} x="-2" y="3" width="36" height="5" rx="2.5" fill="#6a56c8" />
                      </g>

                      {/* Row 3: Cycling purple checkbox & bar */}
                      <g className="cga-row" style={{ '--i': 2 }}>
                        <rect className="cga-bx3" x="-32" y="21" width="26" height="26" rx="7" fill="#12102a" stroke="#7a63d8" strokeWidth="3" />
                        <path className="cga-chk cga-k3" pathLength="1" d="M-26 34L-21 39L-12 29" />
                        <rect className="cga-bar" style={{ '--i': 2 }} x="2" y="24" width="34" height="5" rx="2.5" fill="#6a56c8" opacity=".7" />
                        <rect className="cga-bar" style={{ '--i': 2 }} x="5" y="38" width="26" height="5" rx="2.5" fill="#6a56c8" opacity=".7" />
                      </g>
                    </g>
                  </g>
                </g>

                {/* Front Ring Segment & Front Comet */}
                <g transform="translate(198 167) rotate(-17)">
                  <path className="cga-ring" pathLength="1" d="M-107 0A107 33 0 0 0 107 0" style={{ stroke: `url(#${p}rg)` }} />
                  <path className="cga-cm cga-cf" pathLength="1" d="M-107 0A107 33 0 0 0 107 0" />
                </g>

                {/* Interactive Plus Action Button */}
                <g transform="translate(258 220) rotate(-8)">
                  <g className="cga-pin">
                    <g className="cga-pfl">
                      <g
                        className={`cga-pb ${isHit ? 'hit' : ''}`}
                        onClick={handlePlusClick}
                        title="Tap for confetti celebration!"
                      >
                        <rect x="-29" y="-29" width="58" height="58" rx="17" fill={`url(#${p}bg)`} stroke="#c4ffa0" strokeWidth="3" />
                        <rect x="-21" y="-21" width="42" height="42" rx="12" fill="#0d3f18" />
                        <rect x="-13" y="-3.5" width="26" height="7" rx="3.5" fill="#fff" />
                        <rect x="-3.5" y="-13" width="7" height="26" rx="3.5" fill="#fff" />
                      </g>
                    </g>
                  </g>
                </g>

                {/* Ripple Expansion */}
                <circle className="cga-rp" cx="258" cy="220" r="12" />

                {/* Spark Rays */}
                <path className="cga-spk" pathLength="1" d="M284 174L287 186" />
                <path className="cga-spk" pathLength="1" d="M295 184L303 191" style={{ animationDelay: '2.12s, var(--d, 3.6s)' }} />
                <path className="cga-spk" pathLength="1" d="M298 203L309 203" style={{ animationDelay: '2.2s, var(--d, 3.6s)' }} />

                {/* Dynamic Swish Line */}
                <path className="cga-sw" pathLength="1" d="M156 342C185 333 215 333 240 334" style={{ stroke: `url(#${p}sg)` }} />

                {/* Animated Letter Words 'Create a' & 'Goal' */}
                <g>
                  {letters1.map(letter => (
                    <text
                      key={letter.i}
                      className="cga-tl cga-t1"
                      x={letter.x}
                      y={letter.y}
                      style={{ '--i': letter.i }}
                    >
                      {letter.c}
                    </text>
                  ))}
                  {letters2.map(letter => (
                    <text
                      key={letter.i}
                      className="cga-tl cga-t2"
                      x={letter.x}
                      y={letter.y}
                      style={{ '--i': letter.i }}
                      fill={`url(#${p}tg)`}
                    >
                      {letter.c}
                    </text>
                  ))}
                </g>

                {/* Radial Confetti Particles */}
                <g>
                  {confetti.map(particle => (
                    particle.isCircle ? (
                      <circle
                        key={particle.id}
                        className="cga-cfx"
                        cx={particle.x}
                        cy={particle.y}
                        r={particle.radius}
                        fill={particle.fill}
                        style={{
                          '--x': `${particle.targetX}px`,
                          '--y': `${particle.targetY}px`,
                          '--r': `${particle.targetR}deg`,
                          animationDelay: `${particle.delay}s`
                        }}
                      />
                    ) : (
                      <rect
                        key={particle.id}
                        className="cga-cfx"
                        x={particle.x}
                        y={particle.y}
                        width={particle.width}
                        height={particle.height}
                        fill={particle.fill}
                        style={{
                          '--x': `${particle.targetX}px`,
                          '--y': `${particle.targetY}px`,
                          '--r': `${particle.targetR}deg`,
                          animationDelay: `${particle.delay}s`
                        }}
                      />
                    )
                  ))}
                </g>
              </g>
            </g>
          </svg>
        </div>

        {/* Goal Summary Card */}
        <div className="goal-celebration-details">
          <span className="goal-celebration-kicker">✦ SAVINGS MISSION ACTIVATED</span>
          <h3 className="goal-celebration-name">{goalName}</h3>
          <span className="goal-celebration-target">
            Target: <strong>₹{goalTarget.toLocaleString('en-IN')}</strong> · {goalCategory}
          </span>
          <span className="goal-celebration-reward-pill">
            +10 LOOT Coins Added to Wallet
          </span>
        </div>

        {/* Modal Actions */}
        <div className="goal-celebration-actions">
          <button
            type="button"
            className="goal-celebration-secondary"
            onClick={handleReplay}
          >
            ↻ Replay
          </button>
          <button
            type="button"
            className="goal-celebration-primary"
            onClick={onClose}
          >
            Collect & Continue →
          </button>
        </div>
      </div>
    </div>
  )
}
