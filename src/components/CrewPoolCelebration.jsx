import React, { useState, useEffect, useRef, useId, useCallback } from 'react'
import './CrewPoolCelebration.css'

// Scalloped badge path: R=50, a=3, n=14
const SCALLOP_PATH = 'M53.00 0.00L52.87 1.06L52.50 2.10L51.91 3.12L51.14 4.10L50.26 5.04L49.32 5.95L48.38 6.82L47.52 7.67L46.79 8.51L46.23 9.37L45.87 10.26L45.72 11.19L45.77 12.18L46.00 13.23L46.36 14.34L46.81 15.51L47.27 16.72L47.70 17.95L48.02 19.18L48.20 20.38L48.17 21.51L47.93 22.57L47.46 23.51L46.76 24.34L45.86 25.06L44.80 25.65L43.63 26.15L42.40 26.58L41.16 26.97L39.98 27.35L38.90 27.77L37.95 28.26L37.17 28.85L36.56 29.56L36.11 30.41L35.80 31.40L35.61 32.51L35.48 33.73L35.38 35.00L35.26 36.30L35.06 37.58L34.76 38.78L34.31 39.86L33.71 40.78L32.94 41.51L32.02 42.05L30.96 42.39L29.78 42.54L28.53 42.53L27.24 42.42L25.94 42.24L24.69 42.06L23.50 41.93L22.39 41.90L21.38 42.01L20.48 42.31L19.67 42.79L18.93 43.47L18.26 44.32L17.62 45.31L16.98 46.40L16.32 47.52L15.62 48.61L14.85 49.62L14.01 50.48L13.10 51.15L12.12 51.58L11.08 51.77L9.99 51.72L8.87 51.43L7.74 50.96L6.62 50.34L5.52 49.63L4.45 48.91L3.42 48.24L2.42 47.67L1.46 47.25L0.51 47.03L-0.43 47.02L-1.38 47.23L-2.35 47.63L-3.34 48.19L-4.37 48.86L-5.44 49.58L-6.53 50.28L-7.65 50.91L-8.78 51.40L-9.90 51.70L-10.99 51.78L-12.04 51.61L-13.03 51.19L-13.94 50.54L-14.79 49.69L-15.56 48.70L-16.26 47.61L-16.93 46.49L-17.57 45.40L-18.21 44.40L-18.88 43.53L-19.61 42.84L-20.41 42.34L-21.31 42.03L-22.31 41.90L-23.40 41.92L-24.59 42.05L-25.84 42.23L-27.13 42.41L-28.43 42.53L-29.68 42.54L-30.87 42.40L-31.94 42.08L-32.88 41.57L-33.66 40.85L-34.27 39.94L-34.73 38.87L-35.04 37.68L-35.25 36.41L-35.38 35.11L-35.48 33.83L-35.60 32.61L-35.78 31.49L-36.08 30.49L-36.51 29.62L-37.11 28.90L-37.89 28.30L-38.82 27.81L-39.89 27.38L-41.07 27.00L-42.30 26.61L-43.53 26.19L-44.71 25.70L-45.78 25.11L-46.70 24.41L-47.41 23.58L-47.90 22.64L-48.16 21.60L-48.20 20.47L-48.04 19.28L-47.73 18.05L-47.31 16.82L-46.84 15.61L-46.39 14.43L-46.02 13.31L-45.79 12.26L-45.72 11.27L-45.85 10.33L-46.20 9.44L-46.74 8.58L-47.46 7.74L-48.31 6.89L-49.24 6.02L-50.18 5.12L-51.08 4.18L-51.85 3.20L-52.46 2.18L-52.85 1.14L-53.00 0.08L-52.89 -0.97L-52.54 -2.02L-51.96 -3.04L-51.21 -4.02L-50.33 -4.97L-49.39 -5.88L-48.46 -6.75L-47.59 -7.60L-46.85 -8.45L-46.27 -9.30L-45.89 -10.19L-45.73 -11.11L-45.76 -12.10L-45.98 -13.14L-46.33 -14.25L-46.77 -15.42L-47.24 -16.62L-47.67 -17.86L-48.00 -19.08L-48.19 -20.28L-48.18 -21.43L-47.96 -22.48L-47.50 -23.44L-46.82 -24.28L-45.94 -25.00L-44.89 -25.61L-43.73 -26.12L-42.50 -26.55L-41.26 -26.94L-40.07 -27.32L-38.98 -27.73L-38.02 -28.22L-37.23 -28.80L-36.60 -29.50L-36.14 -30.34L-35.82 -31.32L-35.62 -32.42L-35.49 -33.63L-35.39 -34.90L-35.27 -36.20L-35.08 -37.48L-34.79 -38.69L-34.36 -39.78L-33.77 -40.71L-33.01 -41.46L-32.10 -42.02L-31.05 -42.37L-29.88 -42.53L-28.63 -42.54L-27.34 -42.43L-26.05 -42.26L-24.79 -42.07L-23.59 -41.93L-22.47 -41.89L-21.46 -42.00L-20.55 -42.28L-19.73 -42.75L-18.99 -43.41L-18.31 -44.25L-17.67 -45.23L-17.03 -46.31L-16.37 -47.43L-15.67 -48.53L-14.91 -49.54L-14.08 -50.42L-13.18 -51.10L-12.20 -51.56L-11.16 -51.77L-10.08 -51.73L-8.96 -51.46L-7.83 -51.00L-6.71 -50.39L-5.61 -49.69L-4.54 -48.97L-3.50 -48.29L-2.50 -47.71L-1.53 -47.28L-0.58 -47.04L0.36 -47.02L1.30 -47.20L2.27 -47.59L3.26 -48.14L4.29 -48.80L5.35 -49.52L6.44 -50.23L7.56 -50.87L8.69 -51.37L9.81 -51.69L10.91 -51.78L11.96 -51.63L12.95 -51.23L13.87 -50.60L14.72 -49.77L15.50 -48.78L16.21 -47.70L16.88 -46.58L17.52 -45.48L18.16 -44.47L18.82 -43.59L19.55 -42.89L20.34 -42.37L21.23 -42.05L22.22 -41.90L23.31 -41.91L24.49 -42.03L25.74 -42.21L27.03 -42.39L28.32 -42.52L29.59 -42.55L30.78 -42.42L31.86 -42.12L32.81 -41.61L33.60 -40.91L34.23 -40.02L34.70 -38.96L35.02 -37.78L35.23 -36.51L35.37 -35.21L35.47 -33.93L35.59 -32.70L35.76 -31.57L36.05 -30.56L36.47 -29.69L37.06 -28.95L37.82 -28.34L38.74 -27.84L39.80 -27.42L40.97 -27.03L42.20 -26.65L43.44 -26.23L44.62 -25.74L45.70 -25.16L46.63 -24.47L47.36 -23.65L47.87 -22.72L48.15 -21.69L48.21 -20.56L48.06 -19.37L47.76 -18.15L47.34 -16.92L46.88 -15.70L46.43 -14.52L46.05 -13.40L45.80 -12.34L45.72 -11.34L45.83 -10.40L46.16 -9.51L46.69 -8.65L47.40 -7.80L48.24 -6.95L49.17 -6.09L50.11 -5.19L51.01 -4.25L51.80 -3.28L52.42 -2.27L52.83 -1.23L53.00 -0.17Z'

const BURST_COLORS = ['#67ff3a', '#b9ff6a', '#8a4dff', '#ffd84a', '#ffffff', '#b25cff']

function generateBurstParticles(count = 36) {
  const particles = []
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 70 + Math.random() * 170
    const s = 4 + Math.random() * 5
    const isCircle = i % 3 === 0
    const bx = 385 + Math.cos(a) * r
    const by = 283 + Math.sin(a) * r * 0.8 + 30
    particles.push({
      id: `${Date.now()}_${i}_${Math.random()}`,
      isCircle,
      size: s,
      fill: BURST_COLORS[i % BURST_COLORS.length],
      bx,
      by,
      rot: Math.random() * 540 - 270
    })
  }
  return particles
}

/**
 * CrewPoolCelebration Component
 *
 * Full animated celebration triggered whenever a user creates a new Crew Pool.
 * Faithfully ports the "Crew Pool Created" SVG artwork, animated flag wave,
 * scalloped badge checkmark stamp, orbital rings, and celebratory confetti.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether celebration is open
 * @param {Object} [props.pool] - Newly created pool data
 * @param {Function} props.onClose - Close callback
 */
export default function CrewPoolCelebration({ isOpen, pool, onClose }) {
  const [animating, setAnimating] = useState(true)
  const [burstParticles, setBurstParticles] = useState([])
  const rawId = useId()
  const p = `cpc-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-`
  const burstTimerRef = useRef(null)

  const triggerBurst = useCallback(() => {
    setBurstParticles(generateBurstParticles(36))
  }, [])

  const handleReplay = useCallback(() => {
    setAnimating(false)
    setBurstParticles([])
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current)

    setTimeout(() => {
      setAnimating(true)
      burstTimerRef.current = setTimeout(triggerBurst, 1500)
    }, 40)
  }, [triggerBurst])

  useEffect(() => {
    if (!isOpen) return
    burstTimerRef.current = setTimeout(triggerBurst, 1500)

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
    }
  }, [isOpen, onClose, triggerBurst])

  if (!isOpen) return null

  const poolName = pool?.name || 'Goa Trip Crew'
  const poolPurpose = pool?.purpose || 'Shared weekend trip'
  const poolTarget = pool?.target ? Number(pool.target) : 10000
  const membersCount = Array.isArray(pool?.members) ? pool.members.length : 3

  return (
    <div
      className="cpc-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Crew Pool Created Celebration"
    >
      <div className="cpc-modal" onClick={e => e.stopPropagation()}>
        {/* Close Button */}
        <button
          type="button"
          className="cpc-close"
          onClick={onClose}
          aria-label="Close celebration"
        >
          ✕
        </button>

        {/* Animated Artwork Stage */}
        <div
          className="cpc-stage"
          role="button"
          tabIndex={0}
          onClick={handleReplay}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleReplay()
            }
          }}
          title="Tap to replay celebration"
        >
          <svg
            className={`cpc-svg ${animating ? 'cpc-go' : ''}`}
            viewBox="60 30 648 440"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label="Crew Pool Created! Your crew is ready to contribute and reach the goal together."
          >
            <defs>
              <radialGradient id={`${p}amb`} cx=".5" cy=".5" r=".5">
                <stop offset="0" stopColor="#67ff3a" stopOpacity=".16" />
                <stop offset=".55" stopColor="#7a3cff" stopOpacity=".07" />
                <stop offset="1" stopColor="#07060d" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`${p}gBody`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#2fb62e" />
                <stop offset=".6" stopColor="#17731c" />
                <stop offset="1" stopColor="#17731c" stopOpacity="0" />
              </linearGradient>
              <linearGradient id={`${p}gStroke`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#9aff62" stopOpacity=".95" />
                <stop offset=".7" stopColor="#6bf53a" stopOpacity=".35" />
                <stop offset="1" stopColor="#6bf53a" stopOpacity="0" />
              </linearGradient>
              <radialGradient id={`${p}gHead`} cx=".4" cy=".3" r=".85">
                <stop offset="0" stopColor="#34c033" />
                <stop offset="1" stopColor="#176b1c" />
              </radialGradient>
              <linearGradient id={`${p}gFlag`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#238f27" />
                <stop offset="1" stopColor="#0f5a16" />
              </linearGradient>
              <radialGradient id={`${p}gBadge`} cx=".35" cy=".3" r=".9">
                <stop offset="0" stopColor="#b6ff4a" />
                <stop offset="1" stopColor="#43c71b" />
              </radialGradient>
              <radialGradient id={`${p}gInner`} cx=".4" cy=".3" r=".9">
                <stop offset="0" stopColor="#238f2a" />
                <stop offset="1" stopColor="#0c5416" />
              </radialGradient>
              <linearGradient id={`${p}gTitle`} gradientUnits="userSpaceOnUse" x1="400" y1="0" x2="620" y2="0">
                <stop offset="0" stopColor="#8dff1a" />
                <stop offset=".4" stopColor="#6bf51f" />
                <stop offset=".5" stopColor="#eaffb8" />
                <stop offset=".6" stopColor="#6bf51f" />
                <stop offset="1" stopColor="#8dff1a" />
                <animateTransform
                  id={`${p}titleSweep`}
                  attributeName="gradientTransform"
                  type="translate"
                  from="-260 0"
                  to="260 0"
                  dur="4s"
                  begin="2.6s"
                  repeatCount="indefinite"
                />
              </linearGradient>
              <filter id={`${p}glow`} x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id={`${p}glowS`} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="2.5" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id={`${p}blur`} x="-30%" y="-300%" width="160%" height="700%">
                <feGaussianBlur stdDeviation="7" />
              </filter>
            </defs>

            {/* Ambient Glow */}
            <circle cx="382" cy="235" r="330" fill={`url(#${p}amb)`} />

            {/* Purple Floor Glow */}
            <ellipse className="cpc-glowP" cx="382" cy="314" rx="205" ry="10" fill="#7a3cff" opacity=".75" filter={`url(#${p}blur)`} />

            {/* Ring: back (top) half */}
            <g filter={`url(#${p}glowS)`}>
              <path className="cpc-ringBase" pathLength="100" d="M205 266 A177 27 0 0 1 559 266" fill="none" stroke="#7dff4a" strokeWidth="3.2" strokeLinecap="round" />
              <path className="cpc-hl cpc-hlTop" pathLength="100" d="M205 266 A177 27 0 0 1 559 266" fill="none" stroke="#efffd4" strokeWidth="4" strokeLinecap="round" />
            </g>

            {/* Flag */}
            <g filter={`url(#${p}glow)`}>
              <line className="cpc-pole" x1="347" y1="58" x2="319" y2="222" stroke="#7dff3a" strokeWidth="7" strokeLinecap="round" />
              <circle cx="347" cy="58" r="8" fill="#9dff5a" />
              <g className="cpc-flagIn">
                <g className="cpc-cloth">
                  <path d="M346 70 C372 84 396 46 438 56 C453 60 467 66 479 66 L481 138 C453 130 432 151 402 143 C376 137 358 127 337 134 Z" fill={`url(#${p}gFlag)`} stroke="#8aff4a" strokeWidth="2" strokeLinejoin="round" />
                  <g fill="#d6ffd0">
                    <circle cx="399" cy="92" r="4.6" />
                    <circle cx="425" cy="92" r="4.6" />
                    <circle cx="412" cy="87" r="5.6" />
                    <path d="M391 111 Q391 99 399 99 Q407 99 407 111Z" />
                    <path d="M417 111 Q417 99 425 99 Q433 99 433 111Z" />
                    <path d="M401 111 Q401 97 412 97 Q423 97 423 111Z" />
                  </g>
                </g>
              </g>
            </g>

            {/* People */}
            <g filter={`url(#${p}glow)`}>
              <g className="cpc-pop cpc-p1">
                <g className="cpc-bob cpc-b1">
                  <path d="M244 312 V280 Q244 226 290 226 Q334 226 334 262 V312 Z" fill={`url(#${p}gBody)`} stroke={`url(#${p}gStroke)`} strokeWidth="2" />
                  <circle cx="297" cy="192" r="30" fill={`url(#${p}gHead)`} stroke="#8dff5a" strokeOpacity=".75" strokeWidth="2" />
                </g>
              </g>
              <g className="cpc-pop cpc-p3">
                <g className="cpc-bob cpc-b3">
                  <path d="M520 312 V280 Q520 226 474 226 Q430 226 430 262 V312 Z" fill={`url(#${p}gBody)`} stroke={`url(#${p}gStroke)`} strokeWidth="2" />
                  <circle cx="467" cy="192" r="30" fill={`url(#${p}gHead)`} stroke="#8dff5a" strokeOpacity=".75" strokeWidth="2" />
                </g>
              </g>
              <g className="cpc-pop cpc-p2">
                <g className="cpc-bob cpc-b2">
                  <path d="M322 312 V268 Q322 214 382 214 Q442 214 442 268 V312 Z" fill={`url(#${p}gBody)`} stroke={`url(#${p}gStroke)`} strokeWidth="2" />
                  <circle cx="382" cy="175" r="33" fill={`url(#${p}gHead)`} stroke="#8dff5a" strokeOpacity=".8" strokeWidth="2" />
                </g>
              </g>
            </g>

            {/* Ring: front (bottom) half */}
            <g filter={`url(#${p}glowS)`}>
              <path className="cpc-ringBase" pathLength="100" d="M559 266 A177 27 0 0 1 205 266" fill="none" stroke="#7dff4a" strokeWidth="3.2" strokeLinecap="round" />
              <path className="cpc-hl cpc-hlBot" pathLength="100" d="M559 266 A177 27 0 0 1 205 266" fill="none" stroke="#efffd4" strokeWidth="4" strokeLinecap="round" />
            </g>

            {/* Shockwaves */}
            <circle className="cpc-shock" cx="385" cy="283" r="44" fill="none" stroke="#7dff4a" strokeWidth="4" />
            <circle className="cpc-shock2" cx="385" cy="283" r="44" fill="none" stroke="#b36bff" strokeWidth="3" />

            {/* Badge */}
            <g transform="translate(385 283)" filter={`url(#${p}glow)`}>
              <g className="cpc-badge">
                <g className="cpc-bPulse">
                  <path className="cpc-scal" d={SCALLOP_PATH} fill={`url(#${p}gBadge)`} stroke="#c8ff8a" strokeWidth="1.5" />
                  <circle r="37" fill={`url(#${p}gInner)`} stroke="#66f52c" strokeWidth="2.5" />
                  <path className="cpc-chk" pathLength="1" d="M-17 2 L-4 15 L20 -14" fill="none" stroke="#e8ffe2" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              </g>
            </g>

            {/* Confetti */}
            <g>
              <g transform="translate(255 82)"><g className="cpc-cfIn" style={{ '--dx': '130px', '--dy': '201px', '--dl': '1.5s' }}><g className="cpc-cfIdle" style={{ '--rot': '30deg', '--fd': '3.6s' }}><path d="M-15 5 Q-9 -12 14 -10 L15 1 Q1 -1 -6 11 Z" fill="#b25cff" /></g></g></g>
              <g transform="translate(195 145)"><g className="cpc-cfIn" style={{ '--dx': '190px', '--dy': '138px', '--dl': '1.55s' }}><g className="cpc-cfIdle" style={{ '--rot': '-28deg', '--fd': '3.1s' }}><path d="M-16 7 Q-4 -13 16 -3 L11 7 Q1 -2 -9 13 Z" fill="#7cff1a" /></g></g></g>
              <g transform="translate(575 172)"><g className="cpc-cfIn" style={{ '--dx': '-190px', '--dy': '111px', '--dl': '1.6s' }}><g className="cpc-cfIdle" style={{ '--rot': '26deg', '--fd': '3.8s' }}><path d="M-14 -6 L10 -12 L15 -2 Q2 0 -7 10 Z" fill="#b25cff" /></g></g></g>
              <g transform="translate(290 48)"><g className="cpc-cfIn" style={{ '--dx': '95px', '--dy': '235px', '--dl': '1.65s' }}><g className="cpc-cfIdle" style={{ '--rot': '60deg', '--fd': '2.9s' }}><rect x="-4" y="-4" width="8" height="8" rx="1.5" fill="#ffd84a" /></g></g></g>
              <g transform="translate(610 110)"><g className="cpc-cfIn" style={{ '--dx': '-225px', '--dy': '173px', '--dl': '1.7s' }}><g className="cpc-cfIdle" style={{ '--rot': '20deg', '--fd': '3.3s' }}><circle r="4.5" fill="#7cff1a" /></g></g></g>
              <g transform="translate(150 215)"><g className="cpc-cfIn" style={{ '--dx': '235px', '--dy': '68px', '--dl': '1.75s' }}><g className="cpc-cfIdle" style={{ '--rot': '-50deg', '--fd': '3.5s' }}><rect x="-4" y="-4" width="8" height="8" rx="1.5" fill="#ffd84a" /></g></g></g>
              <g transform="translate(640 250)"><g className="cpc-cfIn" style={{ '--dx': '-255px', '--dy': '33px', '--dl': '1.8s' }}><g className="cpc-cfIdle" style={{ '--rot': '15deg', '--fd': '3s' }}><circle r="4" fill="#b25cff" /></g></g></g>
              <g transform="translate(590 70)"><g className="cpc-cfIn" style={{ '--dx': '-205px', '--dy': '213px', '--dl': '1.85s' }}><g className="cpc-cfIdle" style={{ '--rot': '-40deg', '--fd': '3.7s' }}><rect x="-3.5" y="-3.5" width="7" height="7" rx="1.2" fill="#7cff1a" /></g></g></g>
            </g>

            {/* Sparks */}
            <g filter={`url(#${p}glowS)`}>
              <path className="cpc-sp" style={{ '--sd': '1.9s' }} pathLength="1" d="M505 95 L521 76" />
              <path className="cpc-sp" style={{ '--sd': '1.97s' }} pathLength="1" d="M515 107 L541 99" />
              <path className="cpc-sp" style={{ '--sd': '2.04s' }} pathLength="1" d="M516 124 L539 131" />
              <path className="cpc-sp" style={{ '--sd': '2.2s' }} pathLength="1" d="M118 350 L135 362" />
              <path className="cpc-sp" style={{ '--sd': '2.27s' }} pathLength="1" d="M107 380 L131 380" />
              <path className="cpc-sp" style={{ '--sd': '2.34s' }} pathLength="1" d="M120 410 L136 396" />
              <path className="cpc-sp" style={{ '--sd': '2.2s' }} pathLength="1" d="M652 350 L635 364" />
              <path className="cpc-sp" style={{ '--sd': '2.27s' }} pathLength="1" d="M637 380 L661 380" />
              <path className="cpc-sp" style={{ '--sd': '2.34s' }} pathLength="1" d="M632 395 L648 410" />
            </g>

            {/* Animated Title & Subtitle */}
            <text className="cpc-title" x="384" y="394" textAnchor="middle" fontSize="46" fontWeight="800" textLength="458" lengthAdjust="spacingAndGlyphs" fill="#fff">
              <tspan fill="#ffffff">Crew Pool </tspan>
              <tspan fill={`url(#${p}gTitle)`}>Created!</tspan>
            </text>
            <g className="cpc-sub" fill="#cdc6e6" fontSize="20" textAnchor="middle" fontWeight="400">
              <text x="384" y="423" textLength="372" lengthAdjust="spacingAndGlyphs">Your crew is ready to contribute and</text>
              <text x="384" y="450" textLength="248" lengthAdjust="spacingAndGlyphs">reach the goal together.</text>
            </g>

            {/* Dynamic Burst Particles Group */}
            <g>
              {burstParticles.map(pt => (
                pt.isCircle ? (
                  <circle
                    key={pt.id}
                    className="cpc-burst-item"
                    cx="385"
                    cy="283"
                    r={pt.size / 2}
                    fill={pt.fill}
                    style={{
                      '--bx': `${pt.bx}px`,
                      '--by': `${pt.by}px`,
                      '--br': `${pt.rot}deg`
                    }}
                  />
                ) : (
                  <rect
                    key={pt.id}
                    className="cpc-burst-item"
                    x={385 - pt.size / 2}
                    y={283 - pt.size / 2}
                    width={pt.size}
                    height={pt.size}
                    rx="1"
                    fill={pt.fill}
                    style={{
                      '--bx': `${pt.bx}px`,
                      '--by': `${pt.by}px`,
                      '--br': `${pt.rot}deg`
                    }}
                  />
                )
              ))}
            </g>
          </svg>
        </div>

        {/* Pool Summary Card */}
        <div className="cpc-details">
          <span className="cpc-kicker">✦ CREW SAVINGS MISSION ACTIVATED ✦</span>
          <h3 className="cpc-name">{poolName}</h3>
          <p className="cpc-subtext">{poolPurpose}</p>
          <div className="cpc-pills-row">
            <span className="cpc-pill target">Target: ₹{poolTarget.toLocaleString('en-IN')}</span>
            <span className="cpc-pill members">{membersCount} Crew Members</span>
            <span className="cpc-pill reward">+10 LOOT Coins Added</span>
          </div>
        </div>

        {/* Actions */}
        <div className="cpc-actions">
          <button
            type="button"
            className="cpc-btn secondary"
            onClick={handleReplay}
          >
            ↻ Replay
          </button>
          <button
            type="button"
            className="cpc-btn primary"
            onClick={onClose}
          >
            Crew Ready! Continue →
          </button>
        </div>
        <span className="cpc-hint">Tap anywhere on the stage to replay the blast</span>
      </div>
    </div>
  )
}
