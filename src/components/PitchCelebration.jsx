import React, { useState, useEffect, useRef, useId, useCallback } from 'react'
import { playPitchFanfareSound } from '../utils/sfx'
import './PitchCelebration.css'

const COL = ['#3dff8a', '#7b61ff', '#ffc22e', '#ffffff', '#b9a8ff']
const rnd = (a, b) => a + Math.random() * (b - a)

// Default letter positions for fallback before dynamic font measurement
const DEFAULT_L1 = [
  { c: 'B', x: 348, y: 341, d: 0.95, cls: 'pca-t1' },
  { c: 'o', x: 418, y: 341, d: 1.02, cls: 'pca-t1' },
  { c: 'o', x: 486, y: 341, d: 1.09, cls: 'pca-t1' },
  { c: 'm', x: 554, y: 341, d: 1.16, cls: 'pca-t1' },
  { c: '!', x: 650, y: 341, d: 1.23, cls: 'pca-t1' }
]

const S2_TEXT = 'You’ve made your pitch!'
const PI_INDEX = S2_TEXT.indexOf('pitch')

const DEFAULT_L2 = [...S2_TEXT].map((c, i) => {
  if (c === ' ') return null
  return {
    c,
    x: 275 + i * 20.5,
    y: 389,
    d: 1.5 + i * 0.03,
    cls: 'pca-t2' + (i >= PI_INDEX ? ' gp' : '')
  }
}).filter(Boolean)

/**
 * PitchCelebration Component
 *
 * Full animated celebration triggered whenever a teen lodges/pitches to parents.
 * Faithfully ports the "Boom! Pitch made" SVG + Canvas animation specification.
 * Includes interactive 3D tilt, canvas confetti, sparks, shockwave rings, and Web Audio SFX.
 *
 * @param {Object} props
 * @param {boolean} props.isOpen - Whether the celebration modal is open
 * @param {Object} [props.pitch] - The pitch data (purpose, amount, reason, chores, tasks)
 * @param {boolean} [props.sfxMuted=false] - Whether global audio is muted
 * @param {Function} props.onClose - Dismiss callback
 */
export default function PitchCelebration({
  isOpen = true,
  pitch,
  sfxMuted = false,
  onClose
}) {
  const rawId = useId()
  const p = `pm-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}-`

  const svgRef = useRef(null)
  const canvasRef = useRef(null)
  const cardRef = useRef(null)
  const shkRef = useRef(null)
  const flashRef = useRef(null)
  const stageRef = useRef(null)

  const [playKey, setPlayKey] = useState(0)
  const [localMuted, setLocalMuted] = useState(sfxMuted)
  const [measuredLetters, setMeasuredLetters] = useState(null)

  const isSoundActive = !localMuted
  const particlesRef = useRef([])
  const timersRef = useRef([])
  const animFrameRef = useRef(null)
  const mousePosRef = useRef({ x: 0, y: 0 })
  const tiltRef = useRef({ rx: 0, ry: 0 })
  const dimsRef = useRef({ w: 0, h: 0 })

  // Clear timers helper
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
  }, [])

  // Dynamic font metrics measurement for Poppins letters
  useEffect(() => {
    if (!isOpen) return

    const measure = () => {
      const svg = svgRef.current
      if (!svg) return

      try {
        const NS = 'http://www.w3.org/2000/svg'

        // Measure 'Boom!'
        const t1 = document.createElementNS(NS, 'text')
        t1.setAttribute('class', 'pca-t1')
        t1.style.font = "italic 800 96px 'Poppins', system-ui, sans-serif"
        t1.textContent = 'Boom!'
        svg.appendChild(t1)
        const tot1 = t1.getComputedTextLength()
        const pos1 = [...'Boom!'].map((_, i) => t1.getStartPositionOfChar(i).x)
        t1.remove()

        // Measure 'You’ve made your pitch!'
        const t2 = document.createElementNS(NS, 'text')
        t2.setAttribute('class', 'pca-t2')
        t2.style.font = "italic 800 44px 'Poppins', system-ui, sans-serif"
        t2.textContent = S2_TEXT
        svg.appendChild(t2)
        const tot2 = t2.getComputedTextLength()
        const pos2 = [...S2_TEXT].map((_, i) => t2.getStartPositionOfChar(i).x)
        t2.remove()

        if (tot1 > 50 && tot2 > 50) {
          const l1 = [...'Boom!'].map((c, i) => ({
            c,
            x: 505 - tot1 / 2 + pos1[i],
            y: 341,
            d: 0.95 + i * 0.07,
            cls: 'pca-t1'
          }))

          const l2 = [...S2_TEXT].map((c, i) => {
            if (c === ' ') return null
            return {
              c,
              x: 503 - tot2 / 2 + pos2[i],
              y: 389,
              d: 1.5 + i * 0.03,
              cls: 'pca-t2' + (i >= PI_INDEX ? ' gp' : '')
            }
          }).filter(Boolean)

          setMeasuredLetters({ l1, l2 })
        }
      } catch {
        // Fallback to pre-calculated positions
      }
    }

    if (document.fonts?.load) {
      document.fonts.load("italic 800 44px Poppins").then(measure, measure)
    } else {
      measure()
    }
  }, [isOpen, playKey])

  // Fire celebratory blast function
  const fireBlast = useCallback((scale = 1, triggerSound = true) => {
    const svg = svgRef.current
    const shk = shkRef.current
    const flash = flashRef.current
    const canvas = canvasRef.current
    if (!svg || !canvas) return

    // Trigger visual shake and flash
    const restartClass = (el, cls) => {
      if (!el) return
      el.classList.remove(cls)
      void el.offsetWidth
      el.classList.add(cls)
    }

    restartClass(svg, 'pca-fire')
    restartClass(shk, 'on')
    restartClass(flash, 'on')

    // Megaphone mouth position in canvas coordinates
    const r = svg.getBoundingClientRect()
    const cr = canvas.getBoundingClientRect()
    const k = r.width / 1000
    const mx = (r.left - cr.left) + 580 * k
    const my = (r.top - cr.top) + 124.5 * k

    const P = particlesRef.current

    // Confetti particles
    const nConf = Math.round(70 * scale)
    for (let i = 0; i < nConf; i++) {
      const t = (-30 + (Math.random() - 0.5) * 55) * (Math.PI / 180)
      const s = rnd(12 * scale, 28 * scale)
      P.push({
        k: 0,
        x: mx,
        y: my,
        vx: Math.cos(t) * s,
        vy: Math.sin(t) * s,
        w: rnd(6, 13),
        h: rnd(3, 8),
        r: rnd(0, 6.28),
        vr: rnd(-0.25, 0.25),
        f: rnd(0, 6.28),
        vf: rnd(0.1, 0.35),
        c: COL[i % COL.length]
      })
    }

    // Spark particles
    const nSparks = Math.round(40 * scale)
    for (let i = 0; i < nSparks; i++) {
      const t = (-30 + (Math.random() - 0.5) * 80) * (Math.PI / 180)
      const s = rnd(5, 18)
      P.push({
        k: 2,
        x: mx,
        y: my,
        vx: Math.cos(t) * s,
        vy: Math.sin(t) * s,
        life: 1,
        dec: rnd(0.02, 0.045)
      })
    }

    // Expanding shockwave rings
    P.push({ k: 3, x: mx, y: my, R: 10, vR: 16, c: '#ffe27a', a: 1 })
    P.push({ k: 3, x: mx, y: my, R: 10, vR: 11, c: '#3dff8a', a: 1 })

    if (scale > 1) {
      for (let i = 0; i < 40; i++) {
        const t = (-90 + (Math.random() - 0.5) * 300) * (Math.PI / 180)
        const s = rnd(6, 15)
        P.push({
          k: 0,
          x: mx,
          y: my,
          vx: Math.cos(t) * s,
          vy: Math.sin(t) * s,
          w: rnd(6, 13),
          h: rnd(3, 8),
          r: rnd(0, 6.28),
          vr: rnd(-0.25, 0.25),
          f: rnd(0, 6.28),
          vf: rnd(0.1, 0.35),
          c: COL[i % COL.length]
        })
      }
    }

    if (triggerSound && isSoundActive) {
      playPitchFanfareSound(scale > 1, !isSoundActive)
    }
  }, [isSoundActive])

  // Canvas size and rendering loop
  useEffect(() => {
    if (!isOpen) return

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resize = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      dimsRef.current = { w: rect.width, h: rect.height }
      canvas.width = Math.max(1, rect.width * d)
      canvas.height = Math.max(1, rect.height * d)
      ctx.setTransform(d, 0, 0, d, 0, 0)
    }

    resize()
    window.addEventListener('resize', resize)

    let last = performance.now()

    const loop = (now) => {
      const dt = Math.min((now - last) / 16.67, 2.5)
      last = now

      const W = dimsRef.current.w
      const H = dimsRef.current.h

      // 3D Tilt calculation
      const mp = mousePosRef.current
      const tr = tiltRef.current
      const card = cardRef.current

      if (card && W > 0 && H > 0 && !prefersReducedMotion) {
        tr.rx += (((mp.y / H - 0.5) * -7) - tr.rx) * 0.08 * dt
        tr.ry += (((mp.x / W - 0.5) * 9) - tr.ry) * 0.08 * dt
        card.style.transform = `rotateX(${tr.rx}deg) rotateY(${tr.ry}deg)`
      }

      // Draw canvas particles
      if (!prefersReducedMotion) {
        ctx.clearRect(0, 0, W, H)
        const P = particlesRef.current

        for (let i = P.length - 1; i >= 0; i--) {
          const pItem = P[i]

          if (pItem.k === 0) {
            // Confetti
            pItem.vy += 0.3 * dt
            pItem.vx *= Math.pow(0.992, dt)
            pItem.vy *= Math.pow(0.994, dt)
            pItem.x += pItem.vx * dt
            pItem.y += pItem.vy * dt
            pItem.r += pItem.vr * dt
            pItem.f += pItem.vf * dt

            if (pItem.y > H + 40 || pItem.x < -60 || pItem.x > W + 60) {
              P.splice(i, 1)
              continue
            }

            ctx.save()
            ctx.translate(pItem.x, pItem.y)
            ctx.rotate(pItem.r)
            ctx.scale(1, Math.cos(pItem.f))
            ctx.fillStyle = pItem.c
            ctx.fillRect(-pItem.w / 2, -pItem.h / 2, pItem.w, pItem.h)
            ctx.restore()
          } else if (pItem.k === 2) {
            // Sparks
            pItem.vx *= Math.pow(0.95, dt)
            pItem.vy *= Math.pow(0.95, dt)
            pItem.vy += 0.1 * dt
            pItem.life -= pItem.dec * dt

            if (pItem.life <= 0) {
              P.splice(i, 1)
              continue
            }

            ctx.globalCompositeOperation = 'lighter'
            ctx.strokeStyle = `rgba(255, 220, 110, ${Math.max(0, pItem.life)})`
            ctx.lineWidth = 2.6
            ctx.beginPath()
            ctx.moveTo(pItem.x, pItem.y)
            ctx.lineTo(pItem.x - pItem.vx * 2.5, pItem.y - pItem.vy * 2.5)
            ctx.stroke()
            ctx.globalCompositeOperation = 'source-over'
            pItem.x += pItem.vx * dt
            pItem.y += pItem.vy * dt
          } else {
            // Rings
            pItem.R += pItem.vR * dt
            pItem.vR *= Math.pow(0.95, dt)
            pItem.a -= 0.02 * dt

            if (pItem.a <= 0) {
              P.splice(i, 1)
              continue
            }

            ctx.globalAlpha = Math.max(0, pItem.a)
            ctx.strokeStyle = pItem.c
            ctx.lineWidth = 2 + pItem.a * 7
            ctx.beginPath()
            ctx.arc(pItem.x, pItem.y, pItem.R, 0, 6.283)
            ctx.stroke()
            ctx.globalAlpha = 1
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(loop)
    }

    animFrameRef.current = requestAnimationFrame(loop)

    return () => {
      window.removeEventListener('resize', resize)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  }, [isOpen])

  // Sequence scheduler on mount / replay
  useEffect(() => {
    if (!isOpen) return

    clearAllTimers()
    particlesRef.current = []

    const svg = svgRef.current
    if (!svg) return

    svg.classList.remove('pca-go', 'pca-fire')
    void svg.offsetWidth
    svg.classList.add('pca-go')

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion) {
      svg.classList.add('pca-fire')
      return
    }

    const later = (fn, delay) => {
      const id = setTimeout(fn, delay)
      timersRef.current.push(id)
      return id
    }

    // Sequence timing from the HTML specification
    later(() => fireBlast(1.5, true), 900)
    later(() => fireBlast(0.7, false), 2000)

    later(function loop() {
      fireBlast(0.6, false)
      later(loop, 6000)
    }, 8000)

    return () => clearAllTimers()
  }, [isOpen, playKey, fireBlast, clearAllTimers])

  // Pointer interactions for 3D tilt
  const handlePointerMove = (e) => {
    if (!stageRef.current) return
    const rect = stageRef.current.getBoundingClientRect()
    mousePosRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  // Interactive tap on the stage triggers a blast
  const handleStageClick = (e) => {
    if (e.target.closest('button')) return
    fireBlast(1.1, true)
  }

  // Replay action
  const handleReplay = useCallback(() => {
    setPlayKey(k => k + 1)
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

  const pitchAmount = pitch?.amount ? Number(pitch.amount) : 2500
  const pitchPurpose = pitch?.purpose || 'Goal Fund'
  const pitchReason = pitch?.reason || 'Pitch submitted for parent review'
  const choresList = Array.isArray(pitch?.tasks) && pitch.tasks.length > 0
    ? pitch.tasks.map(t => t.title)
    : (typeof pitch?.chores === 'string' && pitch.chores.trim()
        ? pitch.chores.split(',').map(s => s.trim()).filter(Boolean)
        : ['Clean room', 'Help around house'])

  return (
    <div
      className="pitch-celebration-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Boom! Pitch Made Celebration"
    >
      <div className="pitch-celebration-modal" onClick={e => e.stopPropagation()}>
        {/* Close Modal Button */}
        <button
          type="button"
          className="pitch-celebration-close"
          onClick={onClose}
          aria-label="Close celebration"
        >
          ×
        </button>

        {/* Animated 3D Stage */}
        <div
          ref={stageRef}
          className="pca-stage"
          onPointerMove={handlePointerMove}
          onClick={handleStageClick}
          title="Tap anywhere to blast!"
        >
          <div ref={cardRef} className="pca-card">
            <div ref={shkRef} className="pca-shk">
              <svg
                ref={svgRef}
                className="pca-svg"
                viewBox="0 0 1000 563"
                role="img"
                aria-label="Boom! You’ve made your pitch!"
              >
                <defs>
                  {/* Panel Path */}
                  <path
                    id={`${p}pp`}
                    pathLength="1"
                    d="M212 200L783 200Q843 200 848.2 259.8L862.3 423.2Q867 478 812 478L188 478Q133 478 136.7 423.1L147.9 259.9Q152 200 212 200Z"
                  />
                  <clipPath id={`${p}pc`}>
                    <use href={`#${p}pp`} />
                  </clipPath>

                  <linearGradient id={`${p}pf`} gradientUnits="userSpaceOnUse" x1="0" y1="200" x2="0" y2="478">
                    <stop offset="0" stopColor="#0a1a2a" stopOpacity=".25" />
                    <stop offset=".6" stopColor="#08281e" stopOpacity=".55" />
                    <stop offset="1" stopColor="#14783f" stopOpacity=".45" />
                  </linearGradient>

                  <linearGradient id={`${p}ps`} gradientUnits="userSpaceOnUse" x1="0" y1="200" x2="0" y2="478">
                    <stop offset="0" stopColor="#5aa0d0" stopOpacity=".4" />
                    <stop offset=".55" stopColor="#2fd37a" />
                    <stop offset="1" stopColor="#5dffa0" />
                  </linearGradient>

                  <linearGradient id={`${p}mp`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#9c88ff" />
                    <stop offset="1" stopColor="#5a3fe0" />
                  </linearGradient>

                  <linearGradient id={`${p}mg2`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#3a24b0" />
                    <stop offset="1" stopColor="#6a55f0" />
                  </linearGradient>

                  <linearGradient id={`${p}gb`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0" stopColor="#5dffa0" />
                    <stop offset="1" stopColor="#16b45a" />
                  </linearGradient>

                  <linearGradient id={`${p}sg`} gradientUnits="userSpaceOnUse" x1="392" x2="615">
                    <stop offset="0" stopColor="#3dff8a" stopOpacity=".1" />
                    <stop offset=".6" stopColor="#5dffa0" />
                    <stop offset="1" stopColor="#3dff8a" />
                  </linearGradient>

                  <radialGradient id={`${p}bk`}>
                    <stop offset="0" stopColor="#3dff8a" stopOpacity=".18" />
                    <stop offset="1" stopColor="#000" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Ambient Floor Shadow */}
                <ellipse cx="500" cy="420" rx="420" ry="140" fill={`url(#${p}bk)`} />

                {/* Backing Panel Fill */}
                <g className="pca-pan">
                  <use href={`#${p}pp`} className="pca-pfill" fill={`url(#${p}pf)`} />
                </g>

                {/* Light Sweep */}
                <g clipPath={`url(#${p}pc)`}>
                  <rect className="pca-sweep" x="150" y="190" width="70" height="300" fill="rgba(255,255,255,.12)" transform="skewX(-20)" />
                </g>

                {/* Glowing Borders */}
                <use href={`#${p}pp`} className="pca-pbd" style={{ stroke: `url(#${p}ps)` }} />
                <use href={`#${p}pp`} className="pca-pcm" />
                <ellipse className="pca-pglow" cx="500" cy="478" rx="260" ry="5" fill="#8dffd6" />

                {/* Celebratory Confetti / Star Shapes */}
                <g className="pca-dc">
                  <path d="M338 105L362 118L350 132Z" fill="#3dff8a" />
                </g>
                <g className="pca-dc pca-d2">
                  <path d="M278 192Q286 172 306 176" stroke="#ffc22e" strokeWidth="9" strokeLinecap="round" fill="none" />
                </g>
                <g className="pca-dc pca-d3">
                  <path d="M718 140L734 142L726 158L712 156Z" fill="#8a5dff" />
                </g>
                <g className="pca-dc pca-d4">
                  <path d="M678 246L700 240L696 254Z" fill="#3dff8a" />
                </g>

                {/* Twinkles */}
                <g className="pca-tw">
                  <path transform="translate(365 228)" d="M0-9L2-2L9 0L2 2L0 9L-2 2L-9 0L-2-2Z" fill="#b9a8ff" />
                </g>
                <g className="pca-tw pca-tw2">
                  <path transform="translate(707 304)" d="M0-11L2.5-2.5L11 0L2.5 2.5L0 11L-2.5 2.5L-11 0L-2.5-2.5Z" fill="#ffc22e" />
                </g>
                <g stroke="#ffc22e" strokeWidth="8" strokeLinecap="round" className="pca-dc">
                  <path d="M306 281L326 298" />
                  <path d="M288 301L320 310" />
                </g>

                {/* Sound Waves from Megaphone Mouth */}
                <g transform="translate(580 124.5) rotate(-30)">
                  <g className="pca-waves">
                    <path className="pca-wv" d="M38 -30A48 48 0 0 1 38 30" />
                    <path className="pca-wv pca-w2" d="M38 -30A48 48 0 0 1 38 30" />
                    <path className="pca-wv pca-w3" d="M38 -30A48 48 0 0 1 38 30" />
                  </g>
                </g>

                {/* 3D Styled Megaphone */}
                <g transform="translate(498 172) rotate(-30)">
                  <g className="pca-mgi">
                    <g className="pca-mgk">
                      <g className="pca-mg">
                        {/* Handle */}
                        <g transform="translate(-30 40) rotate(8)">
                          <path d="M-14 0H20V62Q20 78 4 78H-2Q-14 78 -14 62Z" fill="#4a33c9" />
                          <rect x="-8" y="6" width="8" height="52" rx="4" fill="#7b66ff" opacity=".7" />
                          <rect x="14" y="-6" width="26" height="22" rx="9" fill="#5a45e6" />
                        </g>

                        {/* Back speaker cap */}
                        <rect x="-110" y="-30" width="34" height="60" rx="15" fill="#4a33c9" />

                        {/* Main Cone */}
                        <path d="M-85 -30L95 -86A30 86 0 0 1 95 86L-85 30Q-100 0 -85 -30Z" fill={`url(#${p}mp)`} />
                        <ellipse cx="94" cy="0" rx="26" ry="76" fill={`url(#${p}mg2)`} />
                        <ellipse cx="86" cy="-4" rx="15" ry="30" fill="#7a66ff" />
                        <ellipse cx="90" cy="-4" rx="9" ry="22" fill="#4a33c9" />

                        {/* Metallic / Lime Grip Accents */}
                        <path d="M-62 -36L-22 -50L-22 50L-62 36Q-72 0 -62 -36Z" fill={`url(#${p}gb)`} />
                        <path d="M-52 -34L-26 -43" stroke="#fff" strokeOpacity=".45" strokeWidth="5" strokeLinecap="round" />
                        <path d="M-8 -52L74 -76" stroke="#fff" strokeOpacity=".35" strokeWidth="6" strokeLinecap="round" />
                      </g>
                    </g>
                  </g>
                </g>

                {/* Sunburst Rays */}
                <g stroke="#ffc22e" fill="none">
                  <path className="pca-ray" d="M611 118L635 91" />
                  <path className="pca-ray pca-r2" d="M625 144L661 133" />
                  <path className="pca-ray pca-r3" d="M625 176L652 193" />
                </g>

                {/* Checkmark Stamp & Ring */}
                <circle className="pca-cr" cx="545" cy="229" r="37" />
                <g className="pca-chk">
                  <circle cx="545" cy="229" r="39" fill="#0d1b2a" />
                  <circle cx="545" cy="229" r="35" fill={`url(#${p}gb)`} />
                  <path className="pca-ck" pathLength="1" d="M528 230L541 243L564 216" />
                </g>

                {/* Animated Letter Typography */}
                <g id="txt">
                  {/* Line 1: 'Boom!' */}
                  {letters1.map((letter, i) => (
                    <text
                      key={`l1-${i}`}
                      className={`pca-tl ${letter.cls}`}
                      x={letter.x}
                      y={letter.y}
                      style={{ '--d': `${letter.d}s` }}
                    >
                      {letter.c}
                    </text>
                  ))}

                  {/* Line 2: 'You’ve made your pitch!' */}
                  {letters2.map((letter, i) => (
                    <text
                      key={`l2-${i}`}
                      className={`pca-tl ${letter.cls}`}
                      x={letter.x}
                      y={letter.y}
                      style={{ '--d': `${letter.d}s` }}
                    >
                      {letter.c}
                    </text>
                  ))}
                </g>

                {/* Dynamic Bottom Swoosh */}
                <path className="pca-swp" pathLength="1" d="M392 425Q500 408 615 413" style={{ stroke: `url(#${p}sg)` }} />
              </svg>
            </div>
          </div>

          {/* Flash Effect Overlay */}
          <div ref={flashRef} className="pca-flash" />

          {/* Confetti & Particle Canvas */}
          <canvas ref={canvasRef} className="pca-canvas" />
        </div>

        {/* Pitch Context Card */}
        <div className="pitch-celebration-details">
          <span className="pitch-celebration-kicker">✦ MONEY PROPOSAL SENT TO PARENT ✦</span>
          <h3 className="pitch-celebration-name">
            ₹{pitchAmount.toLocaleString('en-IN')} for {pitchPurpose}
          </h3>
          <p className="pitch-celebration-sub">
            "{pitchReason}"
          </p>

          {choresList.length > 0 && (
            <div className="pitch-celebration-chores-list">
              {choresList.map((chore, idx) => (
                <span key={idx} className="pitch-chore-chip">
                  <span>🧹</span> {chore} <b>(+25 ✦)</b>
                </span>
              ))}
            </div>
          )}

          <span className="pitch-celebration-reward-pill">
            +5 LOOT Coins Awarded for Pitching
          </span>
        </div>

        {/* Action Controls */}
        <div className="pitch-celebration-actions">
          <button
            type="button"
            className="pitch-celebration-btn"
            onClick={handleReplay}
            title="Replay animation sequence"
          >
            ↻ Replay Blast
          </button>

          <button
            type="button"
            className="pitch-celebration-btn"
            onClick={() => setLocalMuted(!localMuted)}
            title={isSoundActive ? 'Mute Sound' : 'Enable Sound'}
          >
            {isSoundActive ? '🔊 Sound: On' : '🔇 Sound: Off'}
          </button>

          <button
            type="button"
            className="pitch-celebration-btn primary"
            onClick={onClose}
          >
            Collect +5 Coins & Continue →
          </button>
        </div>

        <span className="pitch-celebration-hint">Tap anywhere on the blast to fire extra confetti!</span>
      </div>
    </div>
  )
}
