/**
 * Mr. Spark Interactive Tutor - State Management & Tour Definitions
 *
 * Provides:
 * - Persistent onboarding state machine per authenticated user identity
 * - Interactive guided walkthrough steps mapped to real LOOT elements
 * - Contextual advice based on active application section
 * - Interactive help topics catalog
 */

export const TUTORIAL_STATES = {
  NOT_STARTED: 'NOT_STARTED',
  BALANCE_SETUP_COMPLETED: 'BALANCE_SETUP_COMPLETED',
  INTRO_SHOWN: 'INTRO_SHOWN',
  TUTORIAL_IN_PROGRESS: 'TUTORIAL_IN_PROGRESS',
  TUTORIAL_COMPLETED: 'TUTORIAL_COMPLETED',
  TUTORIAL_SKIPPED: 'TUTORIAL_SKIPPED'
}

const STORAGE_PREFIX = 'loot_spark_state_'

/**
 * Normalize user identifier for isolated storage per account
 */
export function getSparkUserKey(userIdOrProfile) {
  if (!userIdOrProfile) return 'default'
  if (typeof userIdOrProfile === 'object') {
    return (userIdOrProfile.email || userIdOrProfile.name || String(userIdOrProfile.id) || 'default')
      .toLowerCase()
      .replace(/[^a-z0-9_.-]/g, '_')
  }
  return String(userIdOrProfile).toLowerCase().replace(/[^a-z0-9_.-]/g, '_')
}

/**
 * Retrieve persistent tutor state for a user
 */
export function getSparkState(userIdOrProfile) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return TUTORIAL_STATES.NOT_STARTED
  }
  const key = `${STORAGE_PREFIX}${getSparkUserKey(userIdOrProfile)}`
  try {
    const stored = window.localStorage.getItem(key)
    if (stored && Object.values(TUTORIAL_STATES).includes(stored)) {
      return stored
    }
    return TUTORIAL_STATES.NOT_STARTED
  } catch {
    return TUTORIAL_STATES.NOT_STARTED
  }
}

/**
 * Set persistent tutor state for a user
 */
export function setSparkState(userIdOrProfile, state) {
  if (typeof window === 'undefined' || !window.localStorage) return
  if (!Object.values(TUTORIAL_STATES).includes(state)) return
  const key = `${STORAGE_PREFIX}${getSparkUserKey(userIdOrProfile)}`
  try {
    window.localStorage.setItem(key, state)
  } catch {
    // Graceful quota handling
  }
}

/**
 * Reset persistent tutor state for testing or switching profiles
 */
export function resetSparkState(userIdOrProfile) {
  if (typeof window === 'undefined' || !window.localStorage) return
  const key = `${STORAGE_PREFIX}${getSparkUserKey(userIdOrProfile)}`
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Ignore
  }
}

/**
 * The Interactive LOOT Guided Tour Steps
 */
export const TOUR_STEPS = [
  {
    id: 'hero-balance',
    page: 'Dashboard',
    selector: '.hero-stat-card:first-child',
    title: 'Available Cash & Balance Engine',
    text: "Here's your total balance! Every expense, incoming cash, and overdraft shortfall updates here in real time.",
    mood: 'talk',
    badge: 'Step 1 of 8'
  },
  {
    id: 'hero-coins',
    page: 'Dashboard',
    selector: '.hero-stat-card:nth-child(2)',
    title: 'LOOT Coins & Player Rank',
    text: 'Earn LOOT Coins for verified money moves! Keep your streak alive to rank up from Saving Rookie to Cash Commander.',
    mood: 'cheer',
    badge: 'Step 2 of 8'
  },
  {
    id: 'savings-missions',
    page: 'Dashboard',
    selector: '.savings-card',
    title: 'Savings Missions Progress',
    text: 'Set savings goals and watch your live progress ring fill up. Every small contribution counts!',
    mood: 'talk',
    badge: 'Step 3 of 8'
  },
  {
    id: 'quick-actions',
    page: 'Dashboard',
    selector: '.quick-actions-card',
    title: 'Instant Action Dock',
    text: 'Fast-track your moves: set a goal, log a spend, open the Coin Vault, or jump into Smart Buy in one tap.',
    mood: 'wave',
    badge: 'Step 4 of 8'
  },
  {
    id: 'wallet-ledger',
    page: 'Wallet',
    selector: '.wallet-card',
    title: 'Certified Ledger & Rewards Store',
    text: 'The Vault records every coin earned with cryptographic audit stamps. You can also redeem perks in the Rewards Store!',
    mood: 'talk',
    badge: 'Step 5 of 8'
  },
  {
    id: 'goals-page',
    page: 'Goals',
    selector: '.goals-grid, .content-wrap',
    title: 'Savings Goals Hub',
    text: 'Create savings targets for gadgets, trips, or college. Every new goal logged awards you +10 LOOT Coins!',
    mood: 'talk',
    badge: 'Step 6 of 8'
  },
  {
    id: 'money-lab',
    page: 'Money Lab',
    selector: '.money-lab-grid',
    title: 'Expenses, Splits & Shortfalls',
    text: 'Log discretionary spends, scan paper receipts with OCR, and split bills equally with your crew.',
    mood: 'talk',
    badge: 'Step 7 of 8'
  },
  {
    id: 'smart-buy',
    page: 'Smart Buy',
    selector: '.smartbuy-search-card',
    title: 'Smart Buy Comparison Engine',
    text: 'Never overpay! Paste any product URL or search an item. We verify live prices across Amazon, Flipkart, Croma, and more.',
    mood: 'cheer',
    badge: 'Step 8 of 8'
  }
]

/**
 * Contextual Greetings by Application Page
 */
export const CONTEXTUAL_PROMPTS = {
  Dashboard: {
    prompt: 'Check your balance, streak, and quick money actions. Need a hand?',
    suggestion: 'Explore LOOT'
  },
  Wallet: {
    prompt: 'Want to know how your coin balance and verified ledger work?',
    suggestion: 'Understand my Wallet'
  },
  Goals: {
    prompt: 'Need help creating a savings goal or tracking your missions?',
    suggestion: 'Create a Goal'
  },
  'Money Lab': {
    prompt: 'Want to log spends, split group bills, or conquer habit challenges?',
    suggestion: 'Explore Money Lab'
  },
  'Smart Buy': {
    prompt: "Paste a product link and I'll show you how to compare store offers!",
    suggestion: 'Use Smart Buy'
  },
  'Loot Hub': {
    prompt: 'Want to understand how crew pools and achievements work?',
    suggestion: 'Understand Pools'
  },
  'Ask Parent': {
    prompt: 'Ready to pitch your parents with a clear request and chore offers?',
    suggestion: 'Understand Ask Parent'
  }
}

/**
 * Interactive Help Topics Catalog
 */
export const SPARK_HELP_TOPICS = [
  {
    id: 'tour',
    title: '⚡ Take the Guided Tour',
    desc: 'Walk through every key feature in LOOT step-by-step.',
    action: 'start-tour'
  },
  {
    id: 'wallet',
    title: '◈ Understand my Wallet',
    desc: 'How LOOT Coins, levels, and the immutable ledger work.',
    page: 'Wallet',
    selector: '.wallet-card',
    explanation: 'Your Wallet is the central economy hub. It tracks your current LOOT Coins, lifetime earnings, and provides an auditable ledger for every reward. You can also redeem perks in the Rewards Store!'
  },
  {
    id: 'goal',
    title: '◎ Create a Goal',
    desc: 'How to save money and earn +10 coin rewards.',
    page: 'Goals',
    selector: '.goals-grid, .content-wrap',
    explanation: 'Goals are your savings missions. Set a target amount and category. Every contribution fills your progress ring, and creating a new goal awards you +10 LOOT Coins!'
  },
  {
    id: 'smartbuy',
    title: '⚡ Use Smart Buy',
    desc: 'Compare prices across Amazon, Flipkart, Croma & Vijay Sales.',
    page: 'Smart Buy',
    selector: '.smartbuy-search-card',
    explanation: 'Smart Buy verifies prices across major stores in seconds. Save the deal directly as a goal, pitch your parents, or use the 24-hour "Sleep on it" rule to beat impulse buying!'
  },
  {
    id: 'moneylab',
    title: '✹ Explore Money Lab',
    desc: 'Logging transactions, splitting bills, and overdraft shortfalls.',
    page: 'Money Lab',
    selector: '.money-lab-grid',
    explanation: 'Money Lab is where you track expenses and shared group costs. If you overspend your available cash, an auditable shortfall is created that automatically settles when you add money!'
  },
  {
    id: 'askparent',
    title: '♡ Understand Ask Parent',
    desc: 'Pitch parents for purchases by offering household chores.',
    page: 'Ask Parent',
    selector: '.content-wrap',
    explanation: 'Instead of just asking for cash, make a structured money pitch! You specify the item, price, rationale, and chores you will complete. Completing chores awards +25 LOOT coins each.'
  },
  {
    id: 'pools',
    title: '✦ Understand Crew Pools',
    desc: 'Save together with friends for joint trips or shared gear.',
    page: 'Loot Hub',
    selector: '.hub-pools, .content-wrap',
    explanation: 'Crew Pools let you and your friends pool money together for gaming rigs, concerts, or group trips. Everyone can track each member’s contribution transparently.'
  },
  {
    id: 'profile',
    title: '◉ View Player Card',
    desc: 'Customize your avatar, bio, and adjust opening balance.',
    page: 'Dashboard',
    action: 'open-profile',
    explanation: 'Your Player Card represents your financial identity. You can customize your avatar, bio, accent colors, and make auditable opening balance adjustments anytime!'
  }
]
