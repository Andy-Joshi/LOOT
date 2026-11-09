import assert from 'node:assert'
import { test, describe, before, after } from 'node:test'
import { fork } from 'node:child_process'
import { unlinkSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  calculateSavingsPace,
  calculateGoalEta,
  calculateSpendingImpact,
  formatEtaDate
} from '../src/services/goalEtaService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const originalDbPath = join(rootDir, 'server', 'db.json')
const isolatedDbPath = join(rootDir, 'server', 'db.eta-test.json')
const TEST_PORT = 3299
const BASE_URL = `http://localhost:${TEST_PORT}`

const request = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const json = await res.json()
  return { status: res.status, ok: res.ok, data: json }
}

describe('LOOT Spending Impact (Q2) & Goal ETA Comprehensive Test Suite', () => {
  let serverProcess

  before(async () => {
    // Create isolated test database
    const initialDb = {
      profile: {
        id: 1,
        name: 'Test Saver',
        email: 'test@example.com',
        rank: 'Saving Rookie',
        coins: 100,
        streak: 2,
        avatar: 'T',
        accent: 'lime',
        bio: 'Testing goal analytics and spending impact.',
        unlockedPerks: [],
        experienceMode: 'test_user'
      },
      goals: [],
      transactions: [],
      splits: [],
      pools: [],
      challenges: [],
      achievements: [],
      pitches: [],
      parentRequests: [],
      coinTransactions: []
    }
    writeFileSync(isolatedDbPath, JSON.stringify(initialDb, null, 2))

    // Launch server on TEST_PORT with isolated DB
    await new Promise((resolve, reject) => {
      serverProcess = fork(join(rootDir, 'server', 'index.js'), [], {
        env: { ...process.env, PORT: String(TEST_PORT), DB_PATH: isolatedDbPath },
        silent: true
      })

      serverProcess.on('error', reject)

      const checkHealth = async (retries = 25) => {
        try {
          const res = await fetch(`${BASE_URL}/api/health`)
          if (res.ok) return resolve()
        } catch {
          if (retries > 0) setTimeout(() => checkHealth(retries - 1), 100)
          else reject(new Error('Server failed to start on port ' + TEST_PORT))
        }
      }
      setTimeout(checkHealth, 200)
    })
  })

  after(() => {
    if (serverProcess) serverProcess.kill()
    if (existsSync(isolatedDbPath)) {
      unlinkSync(isolatedDbPath)
    }
  })

  // ==========================================================================
  // PART 1: PURE DOMAIN ENGINE CALCULATIONS
  // ==========================================================================

  describe('Part 1: Core Domain Engine Calculations', () => {
    test('Calculates illustrative sneakers example: ₹8,000 target, ₹3,000 saved, ₹500/week pace', () => {
      const fixedNow = new Date('2026-11-09T00:00:00Z')
      const goal = {
        id: 101,
        name: 'Sneakers',
        category: 'Lifestyle',
        target: 8000,
        saved: 3000,
        weeklySavingsPace: 500
      }

      const eta = calculateGoalEta(goal, 500, { now: fixedNow })
      assert.strictEqual(eta.target, 8000)
      assert.strictEqual(eta.saved, 3000)
      assert.strictEqual(eta.remaining, 5000)
      assert.strictEqual(eta.progressPercent, 37.5)
      assert.strictEqual(eta.weeklyPace, 500)
      assert.strictEqual(eta.etaWeeks, 10)
      assert.strictEqual(eta.etaDays, 70)
      assert.strictEqual(eta.status, 'On Track')

      // Record ₹500 expense
      const expense = { title: 'New Jacket', amount: -500, category: 'Lifestyle' }
      const impact = calculateSpendingImpact(expense, [goal], { now: fixedNow })

      assert.strictEqual(impact.hasImpact, true)
      assert.strictEqual(impact.primaryImpact.goalName, 'Sneakers')
      assert.strictEqual(impact.primaryImpact.delayDays, 7, 'Must delay goal by exactly 7 days')
      assert.strictEqual(impact.primaryImpact.delayWeeks, 1)
      assert.strictEqual(impact.primaryImpact.badgeText, '+7 DAYS')
      assert.strictEqual(
        impact.primaryImpact.message,
        'That purchase pushes your Sneakers goal back by 7 days.'
      )
      assert.strictEqual(impact.primaryImpact.beforeDays, 70)
      assert.strictEqual(impact.primaryImpact.afterDays, 77)
    })

    test('Division-by-zero protection on zero or negative target and pace', () => {
      const zeroTargetGoal = { id: 1, name: 'Free Item', target: 0, saved: 0 }
      const zeroEta = calculateGoalEta(zeroTargetGoal, 0)
      assert.strictEqual(zeroEta.progressPercent, 0)
      assert.strictEqual(zeroEta.etaWeeks, null)
      assert.strictEqual(zeroEta.formattedEta, 'Start saving to unlock your ETA')

      const zeroPaceGoal = { id: 2, name: 'Headphones', target: 5000, saved: 1000, weeklySavingsPace: 0 }
      const zeroPaceEta = calculateGoalEta(zeroPaceGoal, 0)
      assert.strictEqual(zeroPaceEta.etaWeeks, null)
      assert.strictEqual(zeroPaceEta.status, 'Needs Pace')
    })
  })

  // ==========================================================================
  // PART 2: THE 12 CRITICAL TEST SCENARIOS (E2E & DOMAIN VALIDATION)
  // ==========================================================================

  describe('Part 2: The 12 Critical Specification Scenarios', () => {
    let sneakerGoalId

    test('Scenario 1: Expense that genuinely delays a goal', async () => {
      // 1. Create Sneaker goal with target 8000 and 500/week pace
      const goalRes = await request('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Sneakers',
          category: 'Lifestyle',
          target: 8000,
          weeklySavingsPace: 500
        })
      })
      assert.strictEqual(goalRes.status, 201)
      sneakerGoalId = goalRes.data.id

      // 2. Add ₹3,000 contribution
      const contribRes = await request(`/api/goals/${sneakerGoalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ contribution: 3000 })
      })
      assert.strictEqual(contribRes.status, 200)
      assert.strictEqual(contribRes.data.saved, 3000)
      assert.strictEqual(contribRes.data.remaining, 5000)

      // 3. Post an expense of ₹500 in Lifestyle
      const txRes = await request('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Concert Merch',
          amount: -500,
          category: 'Lifestyle'
        })
      })

      assert.strictEqual(txRes.status, 201)
      assert.ok(txRes.data.spendingImpact, 'Spending impact must be attached to expense response')
      assert.strictEqual(txRes.data.spendingImpact.hasImpact, true)
      assert.strictEqual(txRes.data.spendingImpact.primaryImpact.goalId, sneakerGoalId)
      assert.strictEqual(txRes.data.spendingImpact.primaryImpact.delayDays, 7)
      assert.strictEqual(txRes.data.spendingImpact.primaryImpact.badgeText, '+7 DAYS')
      assert.strictEqual(
        txRes.data.spendingImpact.primaryImpact.message,
        'That purchase pushes your Sneakers goal back by 7 days.'
      )
    })

    test('Scenario 2: Expense that does not affect a goal (neutral confirmation)', async () => {
      // 1. Zero-value expense check
      const zeroImpact = calculateSpendingImpact({ title: 'Zero Tx', amount: 0 }, [
        { id: sneakerGoalId, name: 'Sneakers', target: 8000, saved: 3000, weeklySavingsPace: 500 }
      ])
      assert.strictEqual(zeroImpact.hasImpact, false)
      assert.strictEqual(zeroImpact.reason, 'zero_amount')
      assert.ok(zeroImpact.neutralMessage)

      // 2. Expense when user has no active goals
      const noGoalsImpact = calculateSpendingImpact({ title: 'Dinner', amount: -200 }, [])
      assert.strictEqual(noGoalsImpact.hasImpact, false)
      assert.strictEqual(noGoalsImpact.reason, 'no_active_goals')
      assert.ok(noGoalsImpact.neutralMessage)
    })

    test('Scenario 3: Multiple active goals (primary impact + secondary affected list)', async () => {
      // Create a second active goal in Essentials with pace 250
      const fundRes = await request('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Emergency Fund',
          category: 'Essentials',
          target: 5000,
          weeklySavingsPace: 250
        })
      })
      assert.strictEqual(fundRes.status, 201)
      const fundId = fundRes.data.id

      await request(`/api/goals/${fundId}`, {
        method: 'PATCH',
        body: JSON.stringify({ contribution: 1000 })
      })

      // Fetch state with multiple active goals
      const stateRes = await request('/api/state')
      assert(stateRes.data.goals.length >= 2)

      // Test general discretionary spend of ₹500
      const impact = calculateSpendingImpact(
        { title: 'Mall shopping', amount: -500, category: 'Lifestyle' },
        stateRes.data.goals
      )

      assert.strictEqual(impact.hasImpact, true)
      assert.strictEqual(impact.primaryImpact.goalName, 'Sneakers', 'Category match puts Sneakers first')
      assert.strictEqual(impact.primaryImpact.delayDays, 7)

      // Secondary affected goals list must include Emergency Fund
      assert(impact.otherAffected.length >= 1)
      const secondary = impact.otherAffected.find(g => g.goalName === 'Emergency Fund')
      assert.ok(secondary, 'Emergency Fund must be in other affected goals list')
      assert.strictEqual(secondary.delayDays, 14, '500 expense at 250/wk pace causes 14 days delay')
    })

    test('Scenario 4: Goal with no savings history displays "Start saving to unlock your ETA"', async () => {
      const newGoalRes = await request('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Electric Skateboard',
          category: 'Lifestyle',
          target: 12000
        })
      })
      assert.strictEqual(newGoalRes.status, 201)
      assert.strictEqual(newGoalRes.data.saved, 0)
      assert.strictEqual(newGoalRes.data.weeklySavingsPace, 0)
      assert.strictEqual(newGoalRes.data.formattedEta, 'Start saving to unlock your ETA')
      assert.strictEqual(newGoalRes.data.status, 'Needs Pace')
    })

    test('Scenario 5: Goal with zero savings pace does not invent a completion date', () => {
      const goal = {
        id: 505,
        name: 'Zero Pace Trip',
        target: 10000,
        saved: 500,
        weeklySavingsPace: 0,
        contributions: []
      }
      const eta = calculateGoalEta(goal, 0)
      assert.strictEqual(eta.weeklyPace, 0)
      assert.strictEqual(eta.etaWeeks, null)
      assert.strictEqual(eta.estimatedDate, null, 'Must not invent an estimated completion date')
      assert.strictEqual(eta.formattedEta, 'Start saving to unlock your ETA')
    })

    test('Scenario 6: Goal that is already completed', async () => {
      // 1. Create a goal with target 400
      const compRes = await request('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ name: 'Book Set', target: 400 })
      })
      const bookId = compRes.data.id

      // 2. Contribute full 400 to complete it
      const patchRes = await request(`/api/goals/${bookId}`, {
        method: 'PATCH',
        body: JSON.stringify({ contribution: 400 })
      })
      assert.strictEqual(patchRes.data.completed, true)
      assert.strictEqual(patchRes.data.remaining, 0)
      assert.strictEqual(patchRes.data.progressPercent, 100)
      assert.strictEqual(patchRes.data.status, 'Completed')

      // 3. Verify an expense does not affect already completed goals
      const impact = calculateSpendingImpact(
        { title: 'Coffee', amount: -100, category: 'Lifestyle' },
        [patchRes.data]
      )
      assert.strictEqual(impact.hasImpact, false)
      assert.strictEqual(impact.reason, 'no_active_goals')
    })

    test('Scenario 7: Expense deletion or correction recalibrates state', async () => {
      // 1. Log an expense
      const postRes = await request('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ title: 'Temporary Expense', amount: -300, category: 'Lifestyle' })
      })
      const txId = postRes.data.id

      // 2. Delete the expense
      const delRes = await request(`/api/transactions/${txId}`, { method: 'DELETE' })
      assert.strictEqual(delRes.status, 200)

      // 3. Confirm deletion
      const stateRes = await request('/api/state')
      const found = stateRes.data.transactions.find(t => t.id === txId)
      assert.strictEqual(found, undefined, 'Deleted transaction must not exist in state')
    })

    test('Scenario 8: New savings contribution after an expense updates progress and ETA', async () => {
      // Current sneaker goal: saved = 3000, target = 8000, remaining = 5000
      const prevRes = await request('/api/state')
      const sneakerBefore = prevRes.data.goals.find(g => g.id === sneakerGoalId)
      const prevDays = sneakerBefore.etaDays

      // Add a fresh contribution of ₹1,000
      const patchRes = await request(`/api/goals/${sneakerGoalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ contribution: 1000 })
      })
      assert.strictEqual(patchRes.status, 200)
      assert.strictEqual(patchRes.data.saved, 4000)
      assert.strictEqual(patchRes.data.remaining, 4000)
      assert.strictEqual(patchRes.data.progressPercent, 50)

      // ETA days should be reduced
      assert(patchRes.data.etaDays < prevDays, 'Contributing money must accelerate the ETA')
    })

    test('Scenario 9: Withdrawal from goal savings increases remaining amount and extends ETA', async () => {
      // Sneaker goal currently has ₹4,000 saved
      const withdrawRes = await request(`/api/goals/${sneakerGoalId}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ amount: 1000 })
      })
      assert.strictEqual(withdrawRes.status, 200)
      assert.strictEqual(withdrawRes.data.saved, 3000, 'Saved amount reduced to 3000')
      assert.strictEqual(withdrawRes.data.remaining, 5000, 'Remaining amount increased to 5000')
      assert.strictEqual(withdrawRes.data.completed, false)

      // Verify contribution history records withdrawal entry
      const hasWithdr = withdrawRes.data.contributions.some(c => c.type === 'withdrawal' && c.amount === 1000)
      assert.ok(hasWithdr, 'Goal history must log withdrawal entry')
    })

    test('Scenario 10: Parent-approved locked funds are NOT counted as general goal savings', () => {
      const parentApprovedRequest = {
        id: 'pr-locked-1',
        pitch_id: 'pitch-locked-1',
        title: 'Study Laptop',
        requested_amount: 15000,
        status: 'approved',
        expires_at: new Date(Date.now() + 5 * 86400000).toISOString()
      }

      // Goal history with entry linked to parent request
      const goal = {
        id: 701,
        name: 'Gaming Rig',
        target: 20000,
        saved: 2000,
        contributions: [
          { amount: 1000, type: 'contribution', timestamp: Date.now() - 7 * 86400000 },
          { amount: 1000, type: 'contribution', timestamp: Date.now() - 2 * 86400000 },
          // Unreceived / locked parent fund
          { amount: 15000, type: 'contribution', parentRequestId: 'pr-locked-1', timestamp: Date.now() }
        ]
      }

      const paceInfo = calculateSavingsPace(goal, [], [parentApprovedRequest])
      // Only the two ₹1,000 contributions should count (= ₹2,000 net savings), NOT the locked ₹15,000
      assert.strictEqual(paceInfo.netSavings, 2000, 'Must exclude locked parent funds from savings pace')
    })

    test('Scenario 11: Expired parent approvals are NOT treated as savings', () => {
      const expiredParentRequest = {
        id: 'pr-expired-1',
        title: 'Concert Ticket',
        requested_amount: 3000,
        status: 'expired',
        expires_at: new Date(Date.now() - 2 * 86400000).toISOString() // expired 2 days ago
      }

      const goal = {
        id: 702,
        name: 'Concert Fund',
        target: 4000,
        saved: 500,
        contributions: [
          { amount: 500, type: 'contribution', timestamp: Date.now() - 3 * 86400000 },
          { amount: 3000, type: 'contribution', parentRequestId: 'pr-expired-1', timestamp: Date.now() - 5 * 86400000 }
        ]
      }

      const paceInfo = calculateSavingsPace(goal, [], [expiredParentRequest])
      assert.strictEqual(paceInfo.netSavings, 500, 'Must exclude expired parent approvals from savings pace')
    })

    test('Scenario 12: Page refresh and data persistence preserves calculation integrity', async () => {
      // Fetch state directly via API
      const state1 = await request('/api/state')
      const sneaker1 = state1.data.goals.find(g => g.id === sneakerGoalId)
      assert.ok(sneaker1)

      // Simulate client refresh (second state fetch)
      const state2 = await request('/api/state')
      const sneaker2 = state2.data.goals.find(g => g.id === sneakerGoalId)

      assert.strictEqual(sneaker1.saved, sneaker2.saved)
      assert.strictEqual(sneaker1.target, sneaker2.target)
      assert.strictEqual(sneaker1.remaining, sneaker2.remaining)
      assert.strictEqual(sneaker1.weeklySavingsPace, sneaker2.weeklySavingsPace)
      assert.strictEqual(sneaker1.etaDays, sneaker2.etaDays)
      assert.strictEqual(sneaker1.formattedDate, sneaker2.formattedDate)
      assert.strictEqual(sneaker1.status, sneaker2.status)
    })

    test('Scenario 13: Feature 3 connection: Spending Impact delay exactly matches Goal Card ETA shift', () => {
      const fixedNow = new Date('2026-11-09T00:00:00Z')
      const goal = {
        id: 888,
        name: 'Smart Watch',
        target: 14000,
        saved: 7000,
        weeklySavingsPace: 700,
        category: 'Lifestyle'
      }

      // 1. Goal card baseline ETA
      const baselineEta = calculateGoalEta(goal, 700, { now: fixedNow })
      assert.strictEqual(baselineEta.etaDays, 70) // 7000 / (700/7) = 70 days
      const baselineDate = new Date(baselineEta.estimatedDate)

      // 2. Record expense of ₹700 (1 week of savings)
      const expense = { title: 'Headphones', amount: -700, category: 'Lifestyle' }
      const impact = calculateSpendingImpact(expense, [goal], { now: fixedNow })

      assert.strictEqual(impact.primaryImpact.delayDays, 7)
      const afterDate = new Date(impact.primaryImpact.afterDateIso)

      // 3. Assert mathematical equality between ETA shift and delay
      const daysDifference = Math.round((afterDate.getTime() - baselineDate.getTime()) / 86400000)
      assert.strictEqual(
        daysDifference,
        impact.primaryImpact.delayDays,
        'Goal ETA shift must exactly equal Spending Impact delay'
      )
    })
  })
})
