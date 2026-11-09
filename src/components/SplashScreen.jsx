import React, { useState, useEffect, useCallback } from 'react'
import LootLogo from './LootLogo'
import './SplashScreen.css'

const SESSION_KEY = 'loot_splash_shown'

/**
 * SplashScreen Component
 *
 * Plays the LootLogo intro animation for ~3s on a black background, then fades out.
 * Displays only once per browser session (stored in sessionStorage).
 *
 * @param {Object} props
 * @param {boolean} [props.forceShow=false] - For debugging/replaying the splash screen
 * @param {Function} [props.onFinish] - Callback when splash screen finishes fading out
 */
export default function SplashScreen({ forceShow = false, onFinish }) {
  const [shouldRender, setShouldRender] = useState(() => {
    if (forceShow) return true
    if (typeof window === 'undefined') return false
    return !sessionStorage.getItem(SESSION_KEY)
  })

  const [isFading, setIsFading] = useState(false)

  const dismiss = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(SESSION_KEY, 'true')
      } catch {
        // Safe fallback if storage quota exceeded or disabled
      }
    }
    setIsFading(true)
    const fadeTimer = setTimeout(() => {
      setShouldRender(false)
      if (onFinish) onFinish()
    }, 500)

    return () => clearTimeout(fadeTimer)
  }, [onFinish])

  useEffect(() => {
    if (!shouldRender) return

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Play for at least 4 seconds before fading out to open the app
    const introDuration = prefersReducedMotion ? 400 : 4000
    const totalDuration = prefersReducedMotion ? 500 : 4550

    const fadeTimer = setTimeout(() => {
      setIsFading(true)
    }, introDuration)

    const finishTimer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(SESSION_KEY, 'true')
        } catch {
          // ignore storage error
        }
      }
      setShouldRender(false)
      if (onFinish) onFinish()
    }, totalDuration)

    // Allow keyboard dismissal (Escape or Space)
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') {
        clearTimeout(fadeTimer)
        clearTimeout(finishTimer)
        dismiss()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(finishTimer)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [shouldRender, dismiss, onFinish])

  if (!shouldRender) return null

  return (
    <aside
      className={`loot-splash-screen ${isFading ? 'fading' : ''}`}
      aria-label="Welcome splash screen"
      role="dialog"
      aria-modal="true"
    >
      <div className="loot-splash-content">
        <LootLogo
          intro={true}
          showWordmark={true}
          size="splash"
          ariaLabel="LOOT Animated Splash Logo"
        />

        <div className="loot-splash-bar" aria-hidden="true">
          <i />
        </div>
      </div>

      <button
        type="button"
        className="loot-splash-skip"
        onClick={dismiss}
        title="Skip intro splash"
      >
        Skip ↗
      </button>
    </aside>
  )
}
