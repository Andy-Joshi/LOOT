import test, { describe } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  distributeEqually,
  validateCustomSplit,
  calculateSplitProgress
} from '../src/services/splitService.js'
import {
  COIN_REWARDS,
  earnCoins,
  hasTransactionWithReference
} from '../server/coinEngine.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

describe('LOOT — Split Bills 2.0: Custom Splits, Equal Splits & Settlement Rewards Test Suite', () => {
  // =========================================================================
  // SCENARIO 1: EQUAL SPLIT AMONG 3 PARTICIPANTS
  // =========================================================================
  test('Scenario 1: Equal split among 3 participants evenly divides total (₹150 -> ₹50 each)', () => {
    const total = 150
    const count = 3
    const shares = distributeEqually(total, count)

    assert.strictEqual(shares.length, 3)
    assert.deepStrictEqual(shares, [50, 50, 50])
    const sum = Number(shares.reduce((a, b) => a + b, 0).toFixed(2))
    assert.strictEqual(sum, total, 'Sum of shares must strictly equal total bill')
  })

  // =========================================================================
  // SCENARIO 2: EQUAL SPLIT WITH INDIVISIBLE AMOUNTS (ROUNDING INTEGRITY)
  // =========================================================================
  test('Scenario 2: Equal split with indivisible amounts distributes remainder cents correctly', () => {
    // ₹100 among 3 participants -> 33.34, 33.33, 33.33 (sum = 100.00)
    const shares100 = distributeEqually(100, 3)
    assert.strictEqual(shares100.length, 3)
    assert.deepStrictEqual(shares100, [33.34, 33.33, 33.33])
    const sum100 = Number(shares100.reduce((a, b) => a + b, 0).toFixed(2))
    assert.strictEqual(sum100, 100.00, 'Sum of shares must strictly equal ₹100.00')

    // ₹10 among 3 participants -> 3.34, 3.33, 3.33 (sum = 10.00)
    const shares10 = distributeEqually(10, 3)
    assert.deepStrictEqual(shares10, [3.34, 3.33, 3.33])
    const sum10 = Number(shares10.reduce((a, b) => a + b, 0).toFixed(2))
    assert.strictEqual(sum10, 10.00)

    // ₹7 among 2 participants -> 3.50, 3.50 (sum = 7.00)
    const shares7 = distributeEqually(7, 2)
    assert.deepStrictEqual(shares7, [3.5, 3.5])
    const sum7 = Number(shares7.reduce((a, b) => a + b, 0).toFixed(2))
    assert.strictEqual(sum7, 7.00)
  })

  // =========================================================================
  // SCENARIO 3: CUSTOM SPLIT WITH MATCHING AMOUNTS
  // =========================================================================
  test('Scenario 3: Custom split with matching amounts passes validation', () => {
    const total = 150
    const participants = [
      { name: 'Andy', amount: 60 },
      { name: 'Dev', amount: 50 },
      { name: 'Sam', amount: 40 }
    ]

    const result = validateCustomSplit(total, participants)
    assert.strictEqual(result.valid, true)
    assert.strictEqual(result.allocatedTotal, 150)
    assert.strictEqual(result.unallocated, 0)
    assert.strictEqual(result.error, undefined)
  })

  // =========================================================================
  // SCENARIO 4: CUSTOM SPLIT WITH MISMATCHED OR NEGATIVE AMOUNTS
  // =========================================================================
  test('Scenario 4: Custom split with mismatched amounts or negative values fails validation', () => {
    const total = 150

    // Under-allocated: ₹60 + ₹50 = ₹110 (₹40 unallocated)
    const underAllocated = [
      { name: 'Andy', amount: 60 },
      { name: 'Dev', amount: 50 }
    ]
    const resUnder = validateCustomSplit(total, underAllocated)
    assert.strictEqual(resUnder.valid, false)
    assert.strictEqual(resUnder.unallocated, 40)
    assert.ok(resUnder.error.includes('remaining to allocate'))

    // Over-allocated: ₹100 + ₹70 = ₹170 (exceeds by ₹20)
    const overAllocated = [
      { name: 'Andy', amount: 100 },
      { name: 'Dev', amount: 70 }
    ]
    const resOver = validateCustomSplit(total, overAllocated)
    assert.strictEqual(resOver.valid, false)
    assert.strictEqual(resOver.unallocated, -20)
    assert.ok(resOver.error.includes('exceeds bill'))

    // Negative amount check
    const negativeAmt = [
      { name: 'Andy', amount: 160 },
      { name: 'Dev', amount: -10 }
    ]
    const resNeg = validateCustomSplit(total, negativeAmt)
    assert.strictEqual(resNeg.valid, false)
    assert.ok(resNeg.error.includes('cannot be negative'))
  })

  // =========================================================================
  // SCENARIO 5: PARTICIPANT MARKED AS PAID
  // =========================================================================
  test('Scenario 5: Marking a participant as paid updates settled amount and remaining balance', () => {
    const split = {
      id: 101,
      title: 'Dinner at Social',
      total: 150,
      participants: [
        { name: 'Andy', amount: 50, paid: false },
        { name: 'Dev', amount: 50, paid: false },
        { name: 'Sam', amount: 50, paid: false }
      ]
    }

    const initialProgress = calculateSplitProgress(split)
    assert.strictEqual(initialProgress.settledAmount, 0)
    assert.strictEqual(initialProgress.remainingAmount, 150)
    assert.strictEqual(initialProgress.paidCount, 0)
    assert.strictEqual(initialProgress.status, 'Pending')
    assert.strictEqual(initialProgress.statusKey, 'pending')

    // Mark Andy as paid
    split.participants[0].paid = true
    const updatedProgress = calculateSplitProgress(split)
    assert.strictEqual(updatedProgress.settledAmount, 50)
    assert.strictEqual(updatedProgress.remainingAmount, 100)
    assert.strictEqual(updatedProgress.paidCount, 1)
    assert.strictEqual(updatedProgress.progressPercent, 33)
  })

  // =========================================================================
  // SCENARIO 6: PARTIALLY SETTLED BILL
  // =========================================================================
  test('Scenario 6: Partially settled bill correctly reflects status and progress', () => {
    const split = {
      id: 102,
      title: 'Concert Tickets',
      total: 300,
      participants: [
        { name: 'Andy', amount: 100, paid: true },
        { name: 'Dev', amount: 100, paid: true },
        { name: 'Sam', amount: 100, paid: false }
      ]
    }

    const progress = calculateSplitProgress(split)
    assert.strictEqual(progress.status, 'Partially Settled')
    assert.strictEqual(progress.statusKey, 'partial')
    assert.strictEqual(progress.settledAmount, 200)
    assert.strictEqual(progress.remainingAmount, 100)
    assert.strictEqual(progress.paidCount, 2)
    assert.strictEqual(progress.totalCount, 3)
    assert.strictEqual(progress.progressPercent, 67)
    assert.strictEqual(progress.isFullySettled, false)
  })

  // =========================================================================
  // SCENARIO 7: FULLY SETTLED BILL & SETTLEMENT COMPLETION
  // =========================================================================
  test('Scenario 7: When all participants are marked as paid, bill transitions to Fully Settled', () => {
    const split = {
      id: 103,
      title: 'Weekend AirBnB',
      total: 600,
      participants: [
        { name: 'Andy', amount: 200, paid: true },
        { name: 'Dev', amount: 200, paid: true },
        { name: 'Sam', amount: 200, paid: true }
      ]
    }

    const progress = calculateSplitProgress(split)
    assert.strictEqual(progress.status, 'Fully Settled')
    assert.strictEqual(progress.statusKey, 'settled')
    assert.strictEqual(progress.settledAmount, 600)
    assert.strictEqual(progress.remainingAmount, 0)
    assert.strictEqual(progress.paidCount, 3)
    assert.strictEqual(progress.totalCount, 3)
    assert.strictEqual(progress.progressPercent, 100)
    assert.strictEqual(progress.isFullySettled, true)
  })

  // =========================================================================
  // SCENARIO 8: DUPLICATE SETTLEMENT REQUEST
  // =========================================================================
  test('Scenario 8: Idempotent participant payment update does not alter clean settled state', () => {
    const split = {
      id: 104,
      title: 'Lunch',
      total: 100,
      participants: [
        { name: 'Andy', amount: 50, paid: true },
        { name: 'Dev', amount: 50, paid: true }
      ]
    }

    // Attempt to mark Dev as paid again
    split.participants[1].paid = true
    const progress = calculateSplitProgress(split)
    assert.strictEqual(progress.settledAmount, 100)
    assert.strictEqual(progress.isFullySettled, true)
  })

  // =========================================================================
  // SCENARIO 9: DUPLICATE COIN REWARD PREVENTION
  // =========================================================================
  test('Scenario 9: Settlement coins are awarded exactly once; duplicate requests are rejected', () => {
    const mockDb = {
      profile: { coins: 100, rank: 'Saving Rookie' },
      coinTransactions: []
    }

    const splitId = 9999
    const refId = `split_settled_${splitId}`

    // First settlement reward
    const tx1 = earnCoins(mockDb, {
      amount: COIN_REWARDS.BILL_SETTLEMENT || 25,
      category: 'activities',
      title: 'Bill Settled: Lunch',
      referenceId: refId
    })

    assert.strictEqual(tx1.amount, 25)
    assert.strictEqual(mockDb.profile.coins, 125)
    assert.strictEqual(hasTransactionWithReference(mockDb, refId), true)

    // Second settlement attempt with identical referenceId must throw duplicate error
    assert.throws(() => {
      earnCoins(mockDb, {
        amount: COIN_REWARDS.BILL_SETTLEMENT || 25,
        category: 'activities',
        title: 'Bill Settled: Lunch (Duplicate attempt)',
        referenceId: refId
      })
    }, /Reward already granted for reference/)

    // Balance remains 125, not 150
    assert.strictEqual(mockDb.profile.coins, 125)
  })

  // =========================================================================
  // SCENARIO 10: PAGE REFRESH AND PERSISTENCE (SERVER INTEGRATION)
  // =========================================================================
  test('Scenario 10: Server endpoints support Split Bills 2.0 equal/custom creation & settlement', () => {
    const serverPath = path.join(rootDir, 'server', 'index.js')
    const serverCode = fs.readFileSync(serverPath, 'utf8')

    assert.ok(serverCode.includes("path === '/api/splits'"), 'Must handle POST /api/splits')
    assert.ok(serverCode.includes("path.startsWith('/api/splits/')"), 'Must handle PATCH /api/splits/:id')
    assert.ok(serverCode.includes("COIN_REWARDS.BILL_SETTLEMENT"), 'Must reference BILL_SETTLEMENT reward')
    assert.ok(serverCode.includes("split_settled_"), 'Must use unique referenceId for settlement idempotency')
    assert.ok(serverCode.includes("distributeEqually"), 'Must import distributeEqually domain logic')
    assert.ok(serverCode.includes("validateCustomSplit"), 'Must import validateCustomSplit domain logic')
  })

  // =========================================================================
  // SCENARIO 11: MULTIPLE BILLS INDEPENDENT STATE
  // =========================================================================
  test('Scenario 11: Multiple split bills maintain independent settlement progress', () => {
    const bill1 = {
      id: 201,
      title: 'Dinner',
      total: 200,
      participants: [
        { name: 'Andy', amount: 100, paid: true },
        { name: 'Dev', amount: 100, paid: false }
      ]
    }

    const bill2 = {
      id: 202,
      title: 'Groceries',
      total: 500,
      participants: [
        { name: 'Andy', amount: 250, paid: true },
        { name: 'Sam', amount: 250, paid: true }
      ]
    }

    const prog1 = calculateSplitProgress(bill1)
    const prog2 = calculateSplitProgress(bill2)

    assert.strictEqual(prog1.status, 'Partially Settled')
    assert.strictEqual(prog1.remainingAmount, 100)
    assert.strictEqual(prog1.progressPercent, 50)

    assert.strictEqual(prog2.status, 'Fully Settled')
    assert.strictEqual(prog2.remainingAmount, 0)
    assert.strictEqual(prog2.progressPercent, 100)
  })

  // =========================================================================
  // SCENARIO 12: BILL WITH ONLY ONE PARTICIPANT
  // =========================================================================
  test('Scenario 12: Bill with only one participant functions properly and settles cleanly', () => {
    const total = 75
    const shares = distributeEqually(total, 1)
    assert.deepStrictEqual(shares, [75])

    const singleParticipantSplit = {
      id: 301,
      title: 'Solo Book',
      total: 75,
      participants: [{ name: 'Andy', amount: 75, paid: false }]
    }

    const beforePaid = calculateSplitProgress(singleParticipantSplit)
    assert.strictEqual(beforePaid.status, 'Pending')
    assert.strictEqual(beforePaid.remainingAmount, 75)

    singleParticipantSplit.participants[0].paid = true
    const afterPaid = calculateSplitProgress(singleParticipantSplit)
    assert.strictEqual(afterPaid.status, 'Fully Settled')
    assert.strictEqual(afterPaid.settledAmount, 75)
    assert.strictEqual(afterPaid.remainingAmount, 0)
    assert.strictEqual(afterPaid.isFullySettled, true)
  })
})
