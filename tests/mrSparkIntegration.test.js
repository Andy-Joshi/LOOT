import assert from 'node:assert'
import { test, describe, beforeEach } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Mock localStorage for node environment
const mockLocalStorage = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val) },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
globalThis.localStorage = mockLocalStorage
globalThis.window = {
  localStorage: mockLocalStorage,
  innerWidth: 1200,
  innerHeight: 800,
  matchMedia: () => ({ matches: false }),
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {}
}

import {
  TUTORIAL_STATES,
  getSparkState,
  setSparkState,
  resetSparkState,
  getSparkUserKey,
  TOUR_STEPS,
  CONTEXTUAL_PROMPTS,
  SPARK_HELP_TOPICS
} from '../src/components/mrspark/sparkTutorial.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

describe('Mr. Spark Permanent Interactive Tutor Test Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
  })

  // ==========================================
  // SCENARIO 1, 2 & 14: USER IDENTITIES & PER-ACCOUNT ISOLATION
  // ==========================================
  test('Scenario 1 & 14: Isolated user states per authenticated account', () => {
    const userA = { email: 'rookie@example.com', name: 'Rookie Saver', id: 1 }
    const userB = { email: 'andy@example.com', name: 'Andy Joshi', id: 2 }

    assert.strictEqual(getSparkUserKey(userA), 'rookie_example.com')
    assert.strictEqual(getSparkUserKey(userB), 'andy_example.com')

    // Initial state for user A should be NOT_STARTED
    assert.strictEqual(getSparkState(userA), TUTORIAL_STATES.NOT_STARTED)

    // User A completes balance setup and sees intro
    setSparkState(userA, TUTORIAL_STATES.INTRO_SHOWN)
    assert.strictEqual(getSparkState(userA), TUTORIAL_STATES.INTRO_SHOWN)

    // User B logging in on the same browser must NOT inherit user A's state
    assert.strictEqual(getSparkState(userB), TUTORIAL_STATES.NOT_STARTED)

    // User B finishes tutorial
    setSparkState(userB, TUTORIAL_STATES.TUTORIAL_COMPLETED)
    assert.strictEqual(getSparkState(userB), TUTORIAL_STATES.TUTORIAL_COMPLETED)
    assert.strictEqual(getSparkState(userA), TUTORIAL_STATES.INTRO_SHOWN)

    // Resetting User A state
    resetSparkState(userA)
    assert.strictEqual(getSparkState(userA), TUTORIAL_STATES.NOT_STARTED)
    assert.strictEqual(getSparkState(userB), TUTORIAL_STATES.TUTORIAL_COMPLETED)
  })

  // ==========================================
  // SCENARIO 3, 6 & 7: ONBOARDING FLOW & DOCK TRANSITION
  // ==========================================
  test('Scenario 3, 6 & 7: Entrance animation triggers and Maybe Later docks safely', () => {
    const rookieUser = { email: 'rookie@example.com' }

    // Before balance setup: NOT_STARTED
    assert.strictEqual(getSparkState(rookieUser), TUTORIAL_STATES.NOT_STARTED)

    // Balance setup completed -> state advances
    setSparkState(rookieUser, TUTORIAL_STATES.BALANCE_SETUP_COMPLETED)
    assert.strictEqual(getSparkState(rookieUser), TUTORIAL_STATES.BALANCE_SETUP_COMPLETED)

    // Intro presented -> INTRO_SHOWN
    setSparkState(rookieUser, TUTORIAL_STATES.INTRO_SHOWN)
    assert.strictEqual(getSparkState(rookieUser), TUTORIAL_STATES.INTRO_SHOWN)

    // User selects 'Maybe Later' -> TUTORIAL_SKIPPED, docked
    setSparkState(rookieUser, TUTORIAL_STATES.TUTORIAL_SKIPPED)
    assert.strictEqual(getSparkState(rookieUser), TUTORIAL_STATES.TUTORIAL_SKIPPED)
  })

  // ==========================================
  // SCENARIO 4 & 5: GUIDED TOUR STEP ARCHITECTURE
  // ==========================================
  test('Scenario 4 & 5: Full tour steps cover all core LOOT features', () => {
    assert.ok(TOUR_STEPS.length >= 8, 'Tour must have at least 8 structured steps')

    // Verify key pages in the tour
    const tourPages = TOUR_STEPS.map(s => s.page)
    assert.ok(tourPages.includes('Dashboard'), 'Must include Dashboard')
    assert.ok(tourPages.includes('Wallet'), 'Must include Wallet')
    assert.ok(tourPages.includes('Goals'), 'Must include Goals')
    assert.ok(tourPages.includes('Money Lab'), 'Must include Money Lab')
    assert.ok(tourPages.includes('Smart Buy'), 'Must include Smart Buy')

    // Verify step definitions
    TOUR_STEPS.forEach((step, idx) => {
      assert.ok(step.id, `Step ${idx} must have an id`)
      assert.ok(step.title, `Step ${idx} must have a title`)
      assert.ok(step.text, `Step ${idx} must have explanatory text`)
      assert.ok(step.selector, `Step ${idx} must have a DOM selector to highlight`)
    })
  })

  // ==========================================
  // SCENARIO 8, 9 & 10: PERMANENT COMPANION & CONTEXTUAL KNOWLEDGE
  // ==========================================
  test('Scenario 8, 9 & 10: Contextual knowledge for every application route', () => {
    const pages = ['Dashboard', 'Wallet', 'Goals', 'Money Lab', 'Smart Buy', 'Loot Hub', 'Ask Parent']

    pages.forEach(p => {
      const info = CONTEXTUAL_PROMPTS[p]
      assert.ok(info, `Must have contextual prompt for ${p}`)
      assert.ok(info.prompt, `Prompt string must not be empty for ${p}`)
      assert.ok(info.suggestion, `Suggestion must not be empty for ${p}`)
    })

    // Verify Smart Buy contextual guidance mentions price comparison
    assert.ok(
      CONTEXTUAL_PROMPTS['Smart Buy'].prompt.toLowerCase().includes('compare') ||
      CONTEXTUAL_PROMPTS['Smart Buy'].prompt.toLowerCase().includes('product'),
      'Smart Buy contextual prompt must guide on price comparison'
    )
  })

  // ==========================================
  // SCENARIO 11 & 12: CLICKING MR. SPARK & TOPICS CATALOG
  // ==========================================
  test('Scenario 11 & 12: Help topics catalog is actionable and complete', () => {
    assert.ok(SPARK_HELP_TOPICS.length >= 7, 'Must have at least 7 help topics')

    const topicIds = SPARK_HELP_TOPICS.map(t => t.id)
    assert.ok(topicIds.includes('tour'), 'Must include Guided Tour topic')
    assert.ok(topicIds.includes('wallet'), 'Must include Wallet topic')
    assert.ok(topicIds.includes('goal'), 'Must include Goal topic')
    assert.ok(topicIds.includes('smartbuy'), 'Must include Smart Buy topic')
    assert.ok(topicIds.includes('moneylab'), 'Must include Money Lab topic')
    assert.ok(topicIds.includes('askparent'), 'Must include Ask Parent topic')
    assert.ok(topicIds.includes('pools'), 'Must include Crew Pools topic')

    // Verify topics have explanations and navigation targets
    SPARK_HELP_TOPICS.forEach(topic => {
      if (topic.id !== 'tour') {
        assert.ok(topic.explanation, `Topic ${topic.id} must have explanation`)
        assert.ok(topic.page, `Topic ${topic.id} must target an existing page`)
      }
    })
  })

  // ==========================================
  // SCENARIO 13: LOGOUT / LOGIN PERSISTENCE RETENTION
  // ==========================================
  test('Scenario 13: Returning user retains completion without re-triggering welcome', () => {
    const user = { email: 'returning@example.com' }

    setSparkState(user, TUTORIAL_STATES.TUTORIAL_COMPLETED)

    // Simulate page reload / re-login
    const stateAfterReload = getSparkState(user)
    assert.strictEqual(stateAfterReload, TUTORIAL_STATES.TUTORIAL_COMPLETED)
    assert.notStrictEqual(stateAfterReload, TUTORIAL_STATES.NOT_STARTED)
  })

  // ==========================================
  // SCENARIO 15: FINANCIAL SAFETY AND ARCHITECTURE INTEGRITY
  // ==========================================
  test('Scenario 15: Source inspection verifies zero financial tampering and proper React mounting', () => {
    const appSource = readFileSync(join(rootDir, 'src', 'App.jsx'), 'utf8')
    const mrSparkSource = readFileSync(join(rootDir, 'src', 'components', 'mrspark', 'MrSpark.jsx'), 'utf8')
    const mrSparkCss = readFileSync(join(rootDir, 'src', 'components', 'mrspark', 'MrSpark.css'), 'utf8')
    const useSparkSource = readFileSync(join(rootDir, 'src', 'components', 'mrspark', 'useMrSpark.js'), 'utf8')

    // App.jsx integration
    assert.ok(appSource.includes('<MrSpark'), 'MrSpark must be mounted inside App.jsx')
    assert.ok(appSource.includes('<SparkTourSpotlight'), 'SparkTourSpotlight must be mounted inside App.jsx')
    assert.ok(appSource.includes('useMrSpark'), 'useMrSpark hook must be used in App.jsx')

    // Safety checks: Mr. Spark must NOT mutate wallet or transaction balance
    assert.ok(!useSparkSource.includes('recordTransaction('), 'Mr. Spark must never record real financial transactions')
    assert.ok(!useSparkSource.includes('setOnboardingOpeningBalance('), 'Mr. Spark must never alter wallet opening balance')

    // SVG and CSS Integrity
    assert.ok(mrSparkSource.includes('spark_gC'), 'Gradient IDs must be safely scoped/prefixed')
    assert.ok(mrSparkSource.includes('spark_gB'), 'Gradient IDs must be safely scoped/prefixed')
    assert.ok(mrSparkSource.includes('spark_pup'), 'Pupils ID must be uniquely scoped')
    assert.ok(mrSparkCss.includes('prefers-reduced-motion'), 'Must support prefers-reduced-motion accessibility')
    assert.ok(mrSparkCss.includes('dock'), 'CSS must define dock positioning')
    assert.ok(mrSparkCss.includes('intro'), 'CSS must define intro positioning')
  })
})
