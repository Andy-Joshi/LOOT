import { useState, useEffect, useRef, useCallback } from 'react'
import {
  TUTORIAL_STATES,
  getSparkState,
  setSparkState,
  TOUR_STEPS,
  CONTEXTUAL_PROMPTS,
  SPARK_HELP_TOPICS
} from './sparkTutorial'

const prefersReducedMotion = () => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useMrSpark({
  profile,
  activePage,
  setActivePage,
  isBalanceOnboardingDone,
  isDashboardReady,
  setModal
}) {
  const [mode, setMode] = useState('hidden') // 'hidden' | 'intro' | 'dock' | 'flying'
  const [mood, setMood] = useState('idle') // 'idle' | 'wave' | 'talk' | 'cheer'
  const [bubbleOpen, setBubbleOpen] = useState(false)
  const [bubbleKicker, setBubbleKicker] = useState('MR. SPARK · YOUR GUIDE')
  const [bubbleText, setBubbleText] = useState('')
  const [bubbleButtons, setBubbleButtons] = useState([])
  const [helpMenuOpen, setHelpMenuOpen] = useState(false)
  const [tourStep, setTourStep] = useState(null) // null or index 0..N
  const [particles, setParticles] = useState([])
  const [rings, setRings] = useState([])
  const [pupilOffset, setPupilOffset] = useState({ x: 0, y: 0 })

  const typeWriterIdRef = useRef(0)
  const hideTimerRef = useRef(null)
  const idleTimerRef = useRef(null)
  const sparkElRef = useRef(null)

  const userKey = profile?.email || profile?.name || profile?.id || 'default'

  // Particle shockwave generator
  const createBurst = useCallback((x, y, count = 24) => {
    if (prefersReducedMotion()) return
    const colors = ['#67ff3a', '#b9ff6a', '#8a4dff', '#ffd84a', '#ffffff']

    // Expanding shockwave ring
    const ringId = `ring_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    setRings(prev => [...prev.slice(-3), { id: ringId, x, y }])
    setTimeout(() => {
      setRings(prev => prev.filter(r => r.id !== ringId))
    }, 900)

    // Flying confetti sparks
    const newParticles = []
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = 50 + Math.random() * 110
      newParticles.push({
        id: `bp_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
        x,
        y,
        color: colors[i % colors.length],
        targetX: Math.cos(angle) * radius,
        targetY: Math.sin(angle) * radius
      })
    }
    setParticles(prev => [...prev.slice(-40), ...newParticles])
    setTimeout(() => {
      const idsToRemove = new Set(newParticles.map(p => p.id))
      setParticles(prev => prev.filter(p => !idsToRemove.has(p.id)))
    }, 950)
  }, [])

  // Speak with typewriter text animation
  const say = useCallback((text, options = {}) => {
    const {
      kicker = 'MR. SPARK · YOUR GUIDE',
      buttons = [],
      autoClose = null,
      animateType = true,
      mood: explicitMood = null,
      showMenu = false
    } = options

    const currentTypeId = ++typeWriterIdRef.current
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)

    setBubbleKicker(kicker)
    setBubbleButtons(buttons)
    setHelpMenuOpen(Boolean(showMenu))
    setBubbleOpen(true)

    if (explicitMood) setMood(explicitMood)

    if (!animateType || prefersReducedMotion()) {
      setBubbleText(text)
      if (explicitMood) {
        setTimeout(() => setMood('idle'), 1200)
      }
    } else {
      setMood('talk')
      setBubbleText('')
      let charIdx = 0
      const speed = 22

      const step = () => {
        if (typeWriterIdRef.current !== currentTypeId) return
        charIdx += 1
        setBubbleText(text.slice(0, charIdx))
        if (charIdx < text.length) {
          setTimeout(step, speed)
        } else {
          setMood('idle')
        }
      }
      setTimeout(step, speed)
    }

    if (autoClose) {
      hideTimerRef.current = setTimeout(() => {
        if (typeWriterIdRef.current === currentTypeId) {
          setBubbleOpen(false)
        }
      }, autoClose)
    }
  }, [])

  // Dismiss speech bubble
  const hideBubble = useCallback(() => {
    typeWriterIdRef.current += 1
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setBubbleOpen(false)
    setHelpMenuOpen(false)
    setMood('idle')
  }, [])

  // Start the interactive tour
  const startTour = useCallback((startIndex = 0) => {
    setMode('dock')
    setHelpMenuOpen(false)
    setTourStep(startIndex)
    setSparkState(userKey, TUTORIAL_STATES.TUTORIAL_IN_PROGRESS)
    window.dispatchEvent(new CustomEvent('spark:start-tour'))
  }, [userKey])

  // Transition from Intro to Dock
  const toDock = useCallback((startTourAfter = false) => {
    hideBubble()
    setMode('flying')

    const center = sparkElRef.current
      ? {
          x: sparkElRef.current.offsetLeft + sparkElRef.current.offsetWidth / 2,
          y: sparkElRef.current.offsetTop + sparkElRef.current.offsetHeight / 2
        }
      : { x: window.innerWidth / 2, y: window.innerHeight / 2 }

    createBurst(center.x, center.y, 16)

    setTimeout(() => {
      setMode('dock')
      if (startTourAfter) {
        setMood('cheer')
        setTimeout(() => setMood('idle'), 1400)
        // Begin the tour!
        startTour(0)
      } else {
        setSparkState(userKey, TUTORIAL_STATES.TUTORIAL_SKIPPED)
        say("No problem! I'll be right here whenever you need a hand. Tap me anytime!", {
          autoClose: 3500,
          mood: 'wave'
        })
      }
    }, prefersReducedMotion() ? 50 : 950)
  }, [hideBubble, createBurst, userKey, say, startTour])

  // Trigger First-Time Welcome Intro
  const triggerIntro = useCallback(() => {
    setMode('intro')
    setTourStep(null)
    hideBubble()

    setTimeout(() => {
      const centerX = window.innerWidth / 2
      const centerY = window.innerHeight / 2
      createBurst(centerX, centerY, 32)
      setMood('wave')

      say(
        "Hey! I'm Mr. Spark! Welcome to LOOT. I'll be your little guide whenever you need a hand. Ready to explore?",
        {
          kicker: '✦ WELCOME TO LOOT',
          mood: 'wave',
          buttons: [
            {
              label: 'Show Me Around',
              primary: true,
              onClick: () => {
                setSparkState(userKey, TUTORIAL_STATES.TUTORIAL_IN_PROGRESS)
                toDock(true)
              }
            },
            {
              label: 'Maybe Later',
              primary: false,
              onClick: () => {
                toDock(false)
              }
            }
          ]
        }
      )
    }, 400)
  }, [hideBubble, createBurst, say, toDock, userKey])

  // Handle active tour step rendering and navigation
  useEffect(() => {
    if (tourStep === null) return
    const step = TOUR_STEPS[tourStep]
    if (!step) {
      // Tour completed!
      setTourStep(null)
      setSparkState(userKey, TUTORIAL_STATES.TUTORIAL_COMPLETED)
      if (activePage !== 'Dashboard') {
        setActivePage('Dashboard')
      }
      setMood('cheer')
      createBurst(window.innerWidth - 60, window.innerHeight - 60, 28)
      say(
        "Awesome job! You've seen the core of LOOT. You're ready to earn coins, save cash, and build good money habits. Tap me anytime!",
        {
          kicker: '★ TOUR COMPLETE!',
          mood: 'cheer',
          buttons: [
            {
              label: 'Let’s Go! 🚀',
              primary: true,
              onClick: () => hideBubble()
            }
          ]
        }
      )
      return
    }

    // Switch page if step belongs to another section
    if (step.page && step.page !== activePage) {
      setActivePage(step.page)
    }

    // Present step message with Next / Back / Skip
    const isFirst = tourStep === 0
    const isLast = tourStep === TOUR_STEPS.length - 1

    const buttons = []
    if (!isFirst) {
      buttons.push({
        label: '← Back',
        primary: false,
        onClick: () => setTourStep(prev => Math.max(0, prev - 1))
      })
    }
    buttons.push({
      label: isLast ? 'Finish Tour ✦' : 'Next →',
      primary: true,
      onClick: () => setTourStep(prev => prev + 1)
    })
    buttons.push({
      label: 'Skip',
      primary: false,
      onClick: () => {
        setTourStep(null)
        setSparkState(userKey, TUTORIAL_STATES.TUTORIAL_SKIPPED)
        say("Tour skipped! I'll be hanging out right here whenever you need me.", {
          autoClose: 3200,
          mood: 'wave'
        })
      }
    })

    say(step.text, {
      kicker: `${step.badge} · ${step.title.toUpperCase()}`,
      mood: step.mood || 'talk',
      buttons
    })
  }, [tourStep, activePage, setActivePage, userKey, say, createBurst, hideBubble])

  // Open Help Menu when user taps Mr. Spark
  const handleSparkClick = useCallback(() => {
    if (mode === 'intro') return

    // If currently in a tour, tapping advances or re-shows current step
    if (tourStep !== null) {
      const step = TOUR_STEPS[tourStep]
      if (step) {
        say(step.text, {
          kicker: `${step.badge} · ${step.title.toUpperCase()}`,
          mood: 'talk'
        })
        return
      }
    }

    // Toggle help menu or close if already open
    if (bubbleOpen && helpMenuOpen) {
      hideBubble()
      return
    }

    setMood('wave')
    createBurst(
      window.innerWidth - 60,
      window.innerHeight - (window.innerWidth < 768 ? 130 : 60),
      14
    )

    const contextualInfo = CONTEXTUAL_PROMPTS[activePage] || CONTEXTUAL_PROMPTS.Dashboard

    say(`Need a hand? I'm here! What would you like help with?\n\nTip: ${contextualInfo.prompt}`, {
      kicker: `MR. SPARK · ${activePage.toUpperCase()}`,
      mood: 'talk',
      showMenu: true,
      buttons: [
        {
          label: '✕ Close',
          primary: false,
          onClick: () => hideBubble()
        }
      ]
    })
  }, [mode, tourStep, bubbleOpen, helpMenuOpen, hideBubble, createBurst, activePage, say])

  // Handle selection of a help topic from the menu
  const handleSelectTopic = useCallback((topic) => {
    if (!topic) return

    if (topic.action === 'start-tour') {
      startTour(0)
      return
    }

    if (topic.action === 'open-profile') {
      if (setModal) setModal('profile')
      hideBubble()
      return
    }

    if (topic.page && topic.page !== activePage) {
      setActivePage(topic.page)
    }

    setHelpMenuOpen(false)
    setMood('cheer')

    say(topic.explanation, {
      kicker: topic.title.toUpperCase(),
      mood: 'talk',
      buttons: [
        {
          label: 'Got it! ✓',
          primary: true,
          onClick: () => hideBubble()
        },
        {
          label: 'Take full tour →',
          primary: false,
          onClick: () => startTour(0)
        }
      ]
    })
  }, [activePage, setActivePage, setModal, hideBubble, say, startTour])

  // Automatic First-Time Entrance Orchestration
  useEffect(() => {
    if (!profile || !isDashboardReady) return

    // Check saved state for this specific user
    const currentState = getSparkState(userKey)

    // Case 1: First-time user after wallet balance setup is completed
    if (isBalanceOnboardingDone && currentState === TUTORIAL_STATES.NOT_STARTED) {
      // Mark as balance completed and trigger intro after small delay
      setSparkState(userKey, TUTORIAL_STATES.INTRO_SHOWN)
      const timer = setTimeout(() => {
        triggerIntro()
      }, 700)
      return () => clearTimeout(timer)
    }

    // Case 2: Returning user (or already finished/skipped) -> start docked
    if (
      currentState === TUTORIAL_STATES.INTRO_SHOWN ||
      currentState === TUTORIAL_STATES.TUTORIAL_COMPLETED ||
      currentState === TUTORIAL_STATES.TUTORIAL_SKIPPED ||
      currentState === TUTORIAL_STATES.BALANCE_SETUP_COMPLETED
    ) {
      setMode('dock')
    }
  }, [profile, isBalanceOnboardingDone, isDashboardReady, userKey, triggerIntro])

  // Eye pupil tracking toward cursor
  useEffect(() => {
    if (mode === 'hidden' || prefersReducedMotion()) return

    const handlePointerMove = (e) => {
      if (!sparkElRef.current) return
      const rect = sparkElRef.current.getBoundingClientRect()
      const sparkCenterX = rect.left + rect.width / 2
      const sparkCenterY = rect.top + rect.height * 0.4

      const dx = e.clientX - sparkCenterX
      const dy = e.clientY - sparkCenterY
      const dist = Math.hypot(dx, dy) || 1
      const maxOffset = Math.min(1, dist / 300) * 4.5

      setPupilOffset({
        x: (dx / dist) * maxOffset,
        y: (dy / dist) * maxOffset
      })
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true })
    return () => window.removeEventListener('pointermove', handlePointerMove)
  }, [mode])

  // Idle occasional wave when docked
  useEffect(() => {
    if (mode !== 'dock' || bubbleOpen || tourStep !== null) return

    const scheduleWave = () => {
      idleTimerRef.current = setTimeout(() => {
        setMood('wave')
        setTimeout(() => setMood('idle'), 1800)
        scheduleWave()
      }, 16000)
    }

    scheduleWave()
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [mode, bubbleOpen, tourStep])

  // Keyboard accessibility: Escape closes speech bubbles or cancel tour
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (mode === 'intro') {
          toDock(false)
        } else if (tourStep !== null) {
          setTourStep(null)
          hideBubble()
        } else if (bubbleOpen) {
          hideBubble()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, tourStep, bubbleOpen, toDock, hideBubble])

  // Expose public API on window for testing / debugging
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.Spark = {
        intro: triggerIntro,
        dock: () => {
          setMode('dock')
          setSparkState(userKey, TUTORIAL_STATES.INTRO_SHOWN)
        },
        reset: () => {
          resetSparkState(userKey)
          setMode('hidden')
          hideBubble()
        },
        startTour: () => startTour(0),
        say: (txt, opts) => say(txt, opts),
        getState: () => getSparkState(userKey)
      }
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.Spark
      }
    }
  }, [triggerIntro, userKey, startTour, say, hideBubble])

  return {
    mode,
    mood,
    bubbleOpen,
    bubbleKicker,
    bubbleText,
    bubbleButtons,
    helpMenuOpen,
    tourStep,
    activeTourStep: tourStep !== null ? TOUR_STEPS[tourStep] : null,
    particles,
    rings,
    pupilOffset,
    sparkElRef,
    handleSparkClick,
    handleSelectTopic,
    hideBubble,
    triggerIntro,
    startTour,
    toDock
  }
}
