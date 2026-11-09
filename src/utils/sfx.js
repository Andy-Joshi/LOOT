// Lightweight synthesized Web Audio SFX (Zero external dependencies)
let audioCtx = null

function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (AudioContext) {
      audioCtx = new AudioContext()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function playCoinSound(muted = false) {
  if (muted) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    // B5 to E6 neon coin chime
    osc.frequency.setValueAtTime(987.77, now)
    osc.frequency.exponentialRampToValueAtTime(1318.51, now + 0.08)

    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.3)
  } catch {
    // Ignore audio errors on autoplay restrictions
  }
}

export function playLevelUpSound(muted = false) {
  if (muted) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    // Arcade fanfare chord notes: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.50]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, now + i * 0.1)

      gain.gain.setValueAtTime(0.15, now + i * 0.1)
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now + i * 0.1)
      osc.stop(now + i * 0.1 + 0.36)
    })
  } catch {
    // Ignore audio errors
  }
}

export function playCelebrationSound(muted = false) {
  if (muted) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'sine'
    osc.frequency.setValueAtTime(440, now)
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15)
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.3)

    gain.gain.setValueAtTime(0.1, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.46)
  } catch {
    // Ignore audio errors
  }
}

export function playPitchFanfareSound(big = true, muted = false) {
  if (muted) return
  try {
    const ctx = getAudioContext()
    if (!ctx) return
    const t = ctx.currentTime

    // 1. Dual oscillator brass fanfare with bandpass filter
    [[0, 233, 0.22], [0.26, 311, 0.55]].forEach(([d, f, len]) => {
      const o = ctx.createOscillator()
      const o2 = ctx.createOscillator()
      const g = ctx.createGain()
      const bp = ctx.createBiquadFilter()

      o.type = 'sawtooth'
      o2.type = 'square'
      o.frequency.value = f
      o2.frequency.value = f * 1.006

      bp.type = 'bandpass'
      bp.frequency.value = 900
      bp.Q.value = 1.1

      g.gain.setValueAtTime(0.0001, t + d)
      g.gain.exponentialRampToValueAtTime(big ? 0.14 : 0.07, t + d + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + len)

      o.connect(bp)
      o2.connect(bp)
      bp.connect(g)
      g.connect(ctx.destination)

      o.start(t + d)
      o2.start(t + d)
      o.stop(t + d + len + 0.05)
      o2.stop(t + d + len + 0.05)
    })

    // 2. Punchy bass impact
    const b = ctx.createOscillator()
    const bg = ctx.createGain()
    b.frequency.setValueAtTime(150, t)
    b.frequency.exponentialRampToValueAtTime(40, t + 0.35)
    bg.gain.setValueAtTime(big ? 0.35 : 0.18, t)
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    b.connect(bg)
    bg.connect(ctx.destination)
    b.start(t)
    b.stop(t + 0.45)

    // 3. High triumphant chime chord (E6, G6, C7)
    if (big) {
      [1318.5, 1568, 2093].forEach((f, i) => {
        const o = ctx.createOscillator()
        const g = ctx.createGain()
        o.type = 'triangle'
        o.frequency.value = f
        const s = t + 0.75 + i * 0.09
        g.gain.setValueAtTime(0.0001, s)
        g.gain.exponentialRampToValueAtTime(0.12, s + 0.01)
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.45)
        o.connect(g)
        g.connect(ctx.destination)
        o.start(s)
        o.stop(s + 0.5)
      })
    }
  } catch {
    // Ignore audio errors
  }
}
