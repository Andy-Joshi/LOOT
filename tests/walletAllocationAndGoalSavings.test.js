import assert from 'node:assert'
import { test, describe, before, after, beforeEach } from 'node:test'
import { fork } from 'node:child_process'
import { unlinkSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  _resetMemoryStoreForTesting,
  setOnboardingOpeningBalance,
  getCentralAccountingState,
  recordTransaction,
  recordGoalContribution,
  recordGoalWithdrawal,
  recordParentApprovalLocked,
  recordParentFundsUnlocked,
  recordParentApprovalExpired
} from '../src/services/moneyEngine.js'
import {
  calculateSavingsPace,
  calculateGoalEta
} from '../src/services/goalEtaService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const isolatedDbPath = join(rootDir, 'server', 'db.wallet-test.json')
const TEST_PORT = 3297
const BASE_URL = `http://localhost:${TEST_PORT}`

const request = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const json = await res.json()
  return { status: res.status, ok: res.ok, data: json }
}

describe('LOOT — Wallet Allocation, Goal Savings & Withdrawal System', () => {
  let serverProcess

  before(async () => {
    // 1. Setup isolated database for backend HTTP tests
    const initialDb = {
      profile: {
        id: 1,
        name: 'Alex Rivera',
        email: 'alex@example.com',
        rank: 'Saving Rookie',
        coins: 100,
        streak: 3,
        avatar: 'A',
        accent: 'lime',
        bio: 'Allocating funds and mastering savings goals.',
        unlockedPerks: [],
        experienceMode: 'test_user',
        openingBalance: 1900
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

    // 2. Launch test server on TEST_PORT
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
          // Retry until ready
        }
        if (retries <= 0) return reject(new Error(`Server failed to start on port ${TEST_PORT}`))
        setTimeout(() => checkHealth(retries - 1), 100)
      }
      checkHealth()
    })
  })

  after(() => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM')
    }
    if (existsSync(isolatedDbPath)) {
      try { unlinkSync(isolatedDbPath) } catch {}
    }
  })

  beforeEach(() => {
    _resetMemoryStoreForTesting()
  })

  describe('Part 1: In-Engine Wallet Allocation & Balance Separation', () => {
    test('Scenario 1: Baseline setup with ₹1,900 available balance', async () => {
      await setOnboardingOpeningBalance(1900)
      const state = await getCentralAccountingState()

      assert.strictEqual(state.availableBalance, 1900, 'Available balance must be ₹1,900')
      assert.strictEqual(state.goalSavings, 0, 'Goal savings must start at ₹0')
      assert.strictEqual(state.lockedFunds, 0, 'Locked funds must start at ₹0')
      assert.strictEqual(state.totalOwnedMoney, 1900, 'Total owned money must be ₹1,900')
      assert.strictEqual(state.totalIncome, 0, 'Initial baseline is not counted as income')
      assert.strictEqual(state.totalExpenses, 0, 'Initial baseline is not counted as expense')
    })

    test('Scenario 2: Goal Contribution of ₹1,000 to Sneakers goal separates available from goal savings', async () => {
      // Starting balance: ₹1,900
      await setOnboardingOpeningBalance(1900)

      // Allocate ₹1,000 to Sneakers
      const tx = await recordGoalContribution({
        goalId: 'goal-sneakers',
        goalName: 'Sneakers',
        amount: 1000,
        userId: 'alex@example.com'
      })

      assert.strictEqual(tx.type, 'GOAL_CONTRIBUTION')
      assert.strictEqual(tx.amount, -1000, 'Deducted from available cash')
      assert.strictEqual(tx.category, 'Goals')
      assert.strictEqual(tx.goalName, 'Sneakers')

      const state = await getCentralAccountingState()
      assert.strictEqual(state.availableBalance, 900, 'Available balance must reduce to ₹900')
      assert.strictEqual(state.goalSavings, 1000, 'Goal savings must be ₹1,000')
      assert.strictEqual(state.lockedFunds, 0, 'Locked funds must remain 0')
      assert.strictEqual(state.totalOwnedMoney, 1900, 'Total owned money must remain ₹1,900 (conserved)')
      assert.strictEqual(state.totalExpenses, 0, 'Goal contribution is not an expense')
    })

    test('Scenario 3: Goal Withdrawal of ₹400 returns money to available balance without double counting', async () => {
      await setOnboardingOpeningBalance(1900)
      await recordGoalContribution({
        goalId: 'goal-sneakers',
        goalName: 'Sneakers',
        amount: 1000
      })

      // User withdraws ₹400
      const tx = await recordGoalWithdrawal({
        goalId: 'goal-sneakers',
        goalName: 'Sneakers',
        amount: 400
      })

      assert.strictEqual(tx.type, 'GOAL_WITHDRAWAL')
      assert.strictEqual(tx.amount, 400, 'Returned to available cash')
      assert.strictEqual(tx.category, 'Goals')
      assert.strictEqual(tx.isGoalWithdrawal, true)

      const state = await getCentralAccountingState()
      assert.strictEqual(state.availableBalance, 1300, 'Available balance must be ₹1,300 (900 + 400)')
      assert.strictEqual(state.goalSavings, 600, 'Goal savings must be ₹600 (1000 - 400)')
      assert.strictEqual(state.totalOwnedMoney, 1900, 'Total owned money must remain ₹1,900')
    })

    test('Scenario 4: Goal withdrawal is strictly NOT treated as income', async () => {
      await setOnboardingOpeningBalance(1900)
      await recordGoalContribution({ goalId: 'goal-1', goalName: 'Sneakers', amount: 1000 })
      await recordGoalWithdrawal({ goalId: 'goal-1', goalName: 'Sneakers', amount: 400 })

      const state = await getCentralAccountingState()
      assert.strictEqual(state.totalIncome, 0, 'Goal withdrawal must NOT increase totalIncome')
    })

    test('Scenario 5: Full goal withdrawal of remaining ₹600 leaves ₹1,900 available and ₹0 in goal', async () => {
      await setOnboardingOpeningBalance(1900)
      await recordGoalContribution({ goalId: 'goal-1', goalName: 'Sneakers', amount: 1000 })
      await recordGoalWithdrawal({ goalId: 'goal-1', goalName: 'Sneakers', amount: 400 })
      await recordGoalWithdrawal({ goalId: 'goal-1', goalName: 'Sneakers', amount: 600 })

      const state = await getCentralAccountingState()
      assert.strictEqual(state.availableBalance, 1900, 'Available balance restored to full ₹1,900')
      assert.strictEqual(state.goalSavings, 0, 'Goal savings completely emptied to ₹0')
      assert.strictEqual(state.totalOwnedMoney, 1900, 'Total owned money stays ₹1,900')
    })

    test('Scenario 6: Attempting to contribute more than available balance throws error', async () => {
      await setOnboardingOpeningBalance(500)

      await assert.rejects(
        async () => {
          await recordGoalContribution({
            goalId: 'goal-1',
            goalName: 'Headphones',
            amount: 600
          })
        },
        /Insufficient available balance/
      )

      const state = await getCentralAccountingState()
      assert.strictEqual(state.availableBalance, 500, 'Available balance unchanged on rejection')
      assert.strictEqual(state.goalSavings, 0, 'No goal savings allocated on rejection')
    })

    test('Scenario 7: Multiple active goals track independent allocations', async () => {
      await setOnboardingOpeningBalance(2500)

      // Goal 1: Sneakers ₹1,000
      await recordGoalContribution({ goalId: 'g-sneakers', goalName: 'Sneakers', amount: 1000 })
      // Goal 2: Gaming Headphones ₹500
      await recordGoalContribution({ goalId: 'g-headphones', goalName: 'Headphones', amount: 500 })

      const state = await getCentralAccountingState()
      assert.strictEqual(state.availableBalance, 1000, 'Available balance: 2500 - 1000 - 500 = 1000')
      assert.strictEqual(state.goalSavings, 1500, 'Total goal savings = 1500')
      assert.strictEqual(state.totalOwnedMoney, 2500, 'Total owned money: 1000 + 1500 = 2500')

      // Withdraw ₹200 from Headphones
      await recordGoalWithdrawal({ goalId: 'g-headphones', goalName: 'Headphones', amount: 200 })
      const afterWithdraw = await getCentralAccountingState()
      assert.strictEqual(afterWithdraw.availableBalance, 1200)
      assert.strictEqual(afterWithdraw.goalSavings, 1300)
      assert.strictEqual(afterWithdraw.totalOwnedMoney, 2500)
    })

    test('Scenario 8: Parent-approved locked funds remain strictly separated from available and goal savings', async () => {
      await setOnboardingOpeningBalance(1900)
      await recordGoalContribution({ goalId: 'g-1', goalName: 'Sneakers', amount: 1000 })

      // Parent approves pitch with ₹2,500 locked funds
      await recordParentApprovalLocked({
        requestId: 'req-123',
        pitchId: 'pitch-99',
        title: 'Football Kit Pitch',
        amount: 2500
      })

      const state = await getCentralAccountingState()
      assert.strictEqual(state.availableBalance, 900, 'Available balance remains ₹900 (locked funds cannot be spent)')
      assert.strictEqual(state.goalSavings, 1000, 'Goal savings remain ₹1,000')
      assert.strictEqual(state.lockedFunds, 2500, 'Locked funds tracked at ₹2,500')
      assert.strictEqual(state.totalOwnedMoney, 1900, 'Total owned money excludes locked parent funds')

      // When unlocked with creditAvailable: true, funds return to available balance
      await recordParentFundsUnlocked({
        requestId: 'req-123',
        pitchId: 'pitch-99',
        title: 'Football Kit Verified',
        amount: 2500,
        creditAvailable: true
      })
      const unlockedState = await getCentralAccountingState()
      assert.strictEqual(unlockedState.lockedFunds, 0, 'Locked funds cleared on unlock')
      assert.strictEqual(unlockedState.availableBalance, 3400, 'Available balance credited on unlock (900 + 2500)')
    })

    test('Scenario 9: Expired parent approval clears locked funds', async () => {
      await setOnboardingOpeningBalance(1900)
      await recordParentApprovalLocked({
        requestId: 'req-exp',
        pitchId: 'pitch-exp',
        title: 'Camp Gear',
        amount: 1500
      })

      let state = await getCentralAccountingState()
      assert.strictEqual(state.lockedFunds, 1500)

      // Approval expires
      await recordParentApprovalExpired({
        requestId: 'req-exp',
        pitchId: 'pitch-exp',
        title: 'Camp Gear Expired',
        amount: 1500
      })

      state = await getCentralAccountingState()
      assert.strictEqual(state.lockedFunds, 0, 'Locked funds cleared on expiry')
      assert.strictEqual(state.availableBalance, 1900, 'Available balance unchanged')
    })

    test('Scenario 10: All 7 required transaction types are supported with full metadata', async () => {
      await setOnboardingOpeningBalance(1000)

      // 1. MONEY_ADDED
      const t1 = await recordTransaction({ type: 'MONEY_ADDED', amount: 500, title: 'Allowance' })
      assert.strictEqual(t1.transaction.type, 'MONEY_ADDED')

      // 2. EXPENSE
      const t2 = await recordTransaction({ type: 'EXPENSE', amount: -200, title: 'Snacks' })
      assert.strictEqual(t2.transaction.type, 'EXPENSE')

      // 3. GOAL_CONTRIBUTION
      const t3 = await recordTransaction({ type: 'GOAL_CONTRIBUTION', amount: 300, goalId: 'g1', goalName: 'Bike', title: 'Bike saving' })
      assert.strictEqual(t3.transaction.type, 'GOAL_CONTRIBUTION')
      assert.strictEqual(t3.transaction.goalName, 'Bike')

      // 4. GOAL_WITHDRAWAL
      const t4 = await recordTransaction({ type: 'GOAL_WITHDRAWAL', amount: 100, goalId: 'g1', goalName: 'Bike', title: 'Bike withdraw' })
      assert.strictEqual(t4.transaction.type, 'GOAL_WITHDRAWAL')

      // 5. PARENT_APPROVAL_LOCKED
      const t5 = await recordTransaction({ type: 'PARENT_APPROVAL_LOCKED', amount: 1000, title: 'Pitch Lock' })
      assert.strictEqual(t5.transaction.type, 'PARENT_APPROVAL_LOCKED')

      // 6. PARENT_FUNDS_UNLOCKED
      const t6 = await recordTransaction({ type: 'PARENT_FUNDS_UNLOCKED', amount: 1000, title: 'Pitch Unlock' })
      assert.strictEqual(t6.transaction.type, 'PARENT_FUNDS_UNLOCKED')

      // 7. PARENT_APPROVAL_EXPIRED
      const t7 = await recordTransaction({ type: 'PARENT_APPROVAL_EXPIRED', amount: 500, title: 'Pitch Expired' })
      assert.strictEqual(t7.transaction.type, 'PARENT_APPROVAL_EXPIRED')

      const state = await getCentralAccountingState()
      assert.strictEqual(state.transactions.length, 7)
    })
  })

  describe('Part 2: Goal ETA Recalculation & Delay Projections', () => {
    test('Scenario 11: Goal ETA accurately reflects contributions and withdrawals', () => {
      const now = new Date('2026-11-09T10:00:00.000Z').getTime()
      const goal = {
        id: 'g-sneakers',
        name: 'Sneakers',
        target: 8000,
        saved: 3000,
        weeklySavingsPace: 500,
        contributions: [
          { type: 'contribution', amount: 3000, timestamp: now - 7 * 86400000 }
        ]
      }

      // Initial state: target 8000, saved 3000 -> remaining 5000 at 500/week -> 10 weeks (70 days)
      const paceBefore = calculateSavingsPace(goal, [], [], { now })
      const etaBefore = calculateGoalEta(goal, paceBefore, { now })
      assert.strictEqual(etaBefore.remaining, 5000)
      assert.strictEqual(etaBefore.etaWeeks, 10)
      assert.strictEqual(etaBefore.etaDays, 70)

      // After user withdraws ₹1,000 -> saved is 2,000, remaining is 6,000
      const goalAfterWithdraw = {
        ...goal,
        saved: 2000,
        contributions: [
          ...goal.contributions,
          { type: 'withdrawal', amount: 1000, timestamp: now }
        ]
      }

      const paceAfter = calculateSavingsPace(goalAfterWithdraw, [], [], { now })
      const etaAfter = calculateGoalEta(goalAfterWithdraw, paceAfter, { now })
      assert.strictEqual(etaAfter.remaining, 6000)
      assert.strictEqual(etaAfter.etaWeeks, 12)
      assert.strictEqual(etaAfter.etaDays, 84)

      // Difference is exactly 14 days delay (2 weeks)
      const delayDays = etaAfter.etaDays - etaBefore.etaDays
      assert.strictEqual(delayDays, 14, 'Withdrawal must delay goal by exactly 14 days')
    })
  })

  describe('Part 3: Backend HTTP API & Persistence Verification', () => {
    let createdGoalId = null

    test('Scenario 12: POST /api/goals creates goal and GET /api/wallet/breakdown returns valid separation', async () => {
      // 1. Check wallet breakdown
      const initialBreakdown = await request('/api/wallet/breakdown')
      assert.strictEqual(initialBreakdown.status, 200)
      assert(typeof initialBreakdown.data.availableBalance === 'number')
      assert(typeof initialBreakdown.data.goalSavings === 'number')
      assert(typeof initialBreakdown.data.lockedFunds === 'number')
      assert(typeof initialBreakdown.data.totalOwnedMoney === 'number')

      // 2. Create a goal with target ₹8,000
      const goalRes = await request('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Sneakers Mission',
          target: 8000,
          weeklySavingsPace: 500,
          category: 'Lifestyle'
        })
      })
      assert.strictEqual(goalRes.status, 201)
      createdGoalId = goalRes.data.id

      // 3. Contribute ₹1,000 to goal
      const contribRes = await request(`/api/goals/${createdGoalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ contribution: 1000 })
      })
      assert.strictEqual(contribRes.status, 200)
      assert.strictEqual(contribRes.data.saved, 1000)

      // 4. Verify transaction was recorded in db.transactions
      const stateRes = await request('/api/state')
      const contribTx = stateRes.data.transactions.find(t => t.type === 'GOAL_CONTRIBUTION' && String(t.goalId) === String(createdGoalId))
      assert.ok(contribTx, 'Goal contribution must be persistently recorded in db.transactions')
      assert.strictEqual(contribTx.amount, -1000)

      // 5. Withdraw ₹400 from goal
      const withdrawRes = await request(`/api/goals/${createdGoalId}/withdraw`, {
        method: 'POST',
        body: JSON.stringify({ amount: 400 })
      })
      assert.strictEqual(withdrawRes.status, 200)
      assert.strictEqual(withdrawRes.data.saved, 600, 'Goal savings reduced to ₹600')

      // 6. Verify withdrawal transaction in db.transactions
      const stateAfter = await request('/api/state')
      const withdrTx = stateAfter.data.transactions.find(t => t.type === 'GOAL_WITHDRAWAL' && String(t.goalId) === String(createdGoalId))
      assert.ok(withdrTx, 'Goal withdrawal must be persistently recorded in db.transactions')
      assert.strictEqual(withdrTx.amount, 400)
      assert.strictEqual(withdrTx.category, 'Goals', 'Withdrawal must not be categorized as Income')
    })
  })

  describe('Part 4: UI Code Structure & Warning Inspection', () => {
    test('Scenario 13: App.jsx contains withdrawal warning, timeline delay, and balance checks', () => {
      const appSource = readFileSync(join(rootDir, 'src', 'App.jsx'), 'utf8')

      assert.ok(appSource.includes("You're moving backwards!"), 'App.jsx must render moving backwards warning')
      assert.ok(appSource.includes('This withdrawal will reduce your savings progress and may delay your goal.'), 'App.jsx must explain withdrawal impact')
      assert.ok(appSource.includes('Pushes your'), 'App.jsx must display goal delay projection')
      assert.ok(appSource.includes('Confirm Withdrawal'), 'App.jsx must require explicit confirmation')
      assert.ok(appSource.includes('GOAL_CONTRIBUTION'), 'App.jsx must record GOAL_CONTRIBUTION transactions')
      assert.ok(appSource.includes('GOAL_WITHDRAWAL'), 'App.jsx must record GOAL_WITHDRAWAL transactions')
      assert.ok(!appSource.includes("category: 'Income',\n        amount: numAmount"), 'App.jsx must not categorize goal withdrawal as Income')
    })

    test('Scenario 14: WalletView.jsx renders balance separation grid and dual financial ledger', () => {
      const walletSource = readFileSync(join(rootDir, 'src', 'components', 'WalletView.jsx'), 'utf8')

      assert.ok(walletSource.includes('TOTAL OWNED MONEY'), 'WalletView must display TOTAL OWNED MONEY')
      assert.ok(walletSource.includes('AVAILABLE BALANCE'), 'WalletView must display AVAILABLE BALANCE')
      assert.ok(walletSource.includes('GOAL SAVINGS'), 'WalletView must display GOAL SAVINGS')
      assert.ok(walletSource.includes('LOCKED FUNDS'), 'WalletView must display LOCKED FUNDS')
      assert.ok(walletSource.includes('Financial Ledger'), 'WalletView must provide Financial Ledger mode')
      assert.ok(walletSource.includes('GOAL_CONTRIBUTION'), 'WalletView must render GOAL_CONTRIBUTION badges')
      assert.ok(walletSource.includes('GOAL_WITHDRAWAL'), 'WalletView must render GOAL_WITHDRAWAL badges')
    })
  })
})
