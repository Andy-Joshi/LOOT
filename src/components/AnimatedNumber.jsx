import React, { useEffect, useState, useRef } from 'react'

/**
 * AnimatedNumber Component
 *
 * Smoothly interpolates numerical values using 60fps requestAnimationFrame easing.
 * Respects prefers-reduced-motion by updating immediately without delay.
 *
 * @param {Object} props
 * @param {number} props.value - Target numerical value
 * @param {string} [props.prefix=''] - E.g. '₹' or '+'
 * @param {string} [props.suffix=''] - E.g. '%' or ' ✦'
 * @param {number} [props.duration=500] - Animation duration in ms
 * @param {boolean} [props.formatIndian=false] - Format with en-IN separators
 */
export default function AnimatedNumber({
  value = 0,
  prefix = '',
  suffix = '',
  duration = 500,
  formatIndian = false
}) {
  const numValue = Number(value) || 0
  const [displayValue, setDisplayValue] = useState(numValue)
  const prevValueRef = useRef(numValue)

  const frameIdRef = useRef(null)

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReducedMotion || duration <= 0) {
      setDisplayValue(numValue)
      prevValueRef.current = numValue
      return
    }

    const startVal = prevValueRef.current
    const diff = numValue - startVal
    if (diff === 0) return

    const startTime = performance.now()

    const update = (now) => {
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / duration)
      // Ease out cubic
      const ease = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startVal + diff * ease)

      setDisplayValue(current)

      if (progress < 1) {
        frameIdRef.current = requestAnimationFrame(update)
      } else {
        prevValueRef.current = numValue
      }
    }

    frameIdRef.current = requestAnimationFrame(update)

    return () => {
      if (frameIdRef.current) cancelAnimationFrame(frameIdRef.current)
    }
  }, [numValue, duration])

  const formatted = formatIndian
    ? displayValue.toLocaleString('en-IN')
    : displayValue.toLocaleString()

  return (
    <span className="animated-number">
      {prefix}{formatted}{suffix}
    </span>
  )
}
