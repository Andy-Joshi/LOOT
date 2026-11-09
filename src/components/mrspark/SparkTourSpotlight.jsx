import React, { useEffect, useState, useCallback } from 'react'

/**
 * SparkTourSpotlight
 * Renders a glowing focus highlight around the currently inspected LOOT element
 */
export default function SparkTourSpotlight({ selector, isActive }) {
  const [rect, setRect] = useState(null)

  const updatePosition = useCallback(() => {
    if (!selector || !isActive) {
      setRect(null)
      return
    }

    try {
      const el = document.querySelector(selector)
      if (!el) {
        setRect(null)
        return
      }

      const r = el.getBoundingClientRect()
      // Scroll into view if out of viewport
      const isInView = (
        r.top >= 0 &&
        r.bottom <= (window.innerHeight || document.documentElement.clientHeight)
      )

      if (!isInView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }

      setRect({
        top: r.top + window.scrollY - 6,
        left: r.left + window.scrollX - 6,
        width: r.width + 12,
        height: r.height + 12
      })
    } catch {
      setRect(null)
    }
  }, [selector, isActive])

  useEffect(() => {
    if (!isActive) return
    updatePosition()

    const timer = setTimeout(updatePosition, 300)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, { passive: true })

    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition)
    }
  }, [isActive, updatePosition])

  if (!isActive || !rect) return null

  return (
    <div
      className="spark-target-highlight"
      style={{
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`
      }}
      aria-hidden="true"
    />
  )
}
