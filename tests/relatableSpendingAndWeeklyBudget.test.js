import test, { describe } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEFAULT_RELATABLE_UNITS,
  calculateRelatableUnits,
  convertToUnit,
  formatRelatableQuantity,
  isQualifyingExpense,
  getBudgetWeekWindow,
  calculateWeeklyBudgetStats
} from '../src/services/budgetService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

describe('LOOT — Q1: Relatable Spending & Weekly Remaining Budget Test Suite', () => {
  // =========================================================================
  // SCENARIO 1 & 2: MATHEMATICALLY ACCURATE RELATABLE UNIT CONVERSIONS
  // =========================================================================
  test('Scenario 1: ₹500 converts to 25 samosas at ₹20 each', () => {
    const samosaUnit = convertToUnit(500, 'samosas')
    assert.strictEqual(samosaUnit.unitPrice, 20, 'Default samosa price must be ₹20')
    assert.strictEqual(samosaUnit.rawQuantity, 25, '500 / 20 = 25')
    assert.strictEqual(samosaUnit.formattedQuantity, '25')
    assert.strictEqual(samosaUnit.label, 'samosas')
    assert.strictEqual(samosaUnit.displayText, '25 samosas')
  })

  test('Scenario 2: ₹500 converts to 5 boba teas at ₹100 each', () => {
    const bobaUnit = convertToUnit(500, 'boba')
    assert.strictEqual(bobaUnit.unitPrice, 100, 'Default boba tea price must be ₹100')
    assert.strictEqual(bobaUnit.rawQuantity, 5, '500 / 100 = 5')
    assert.strictEqual(bobaUnit.formattedQuantity, '5')
    assert.strictEqual(bobaUnit.label, 'boba teas')
    assert.strictEqual(bobaUnit.displayText, '5 boba teas')
  })

  // =========================================================================
  // SCENARIO 3: SWITCHING BETWEEN RUPEES AND RELATABLE MODES
  // =========================================================================
  test('Scenario 3: SpendingBreakdownCard UI contains two-state toggle and supports switching', () => {
    const cardPath = path.join(rootDir, 'src', 'components', 'SpendingBreakdownCard.jsx')
    const cardContent = fs.readFileSync(cardPath, 'utf8')

    assert.ok(cardContent.includes('relatable-toggle-pill'), 'Must contain segmented toggle wrapper')
    assert.ok(cardContent.includes('₹ Rupees'), 'Must have Rupees mode button')
    assert.ok(cardContent.includes('🧋 Relatable'), 'Must have Relatable mode button')
    assert.ok(cardContent.includes("mode === 'rupees'"), 'Must conditionally render rupees mode')
    assert.ok(cardContent.includes("mode === 'relatable'"), 'Must conditionally render relatable mode')
  })

  // =========================================================================
  // SCENARIO 4: DIFFERENT SPENDING AMOUNTS & SENSIBLE DECIMAL QUANTITIES
  // =========================================================================
  test('Scenario 4: Converts varied spending amounts with sensible decimal handling', () => {
    // ₹150 spending
    const samosas150 = convertToUnit(150, 'samosas')
    assert.strictEqual(samosas150.formattedQuantity, '7.5', '150 / 20 = 7.5 samosas')

    const boba150 = convertToUnit(150, 'boba')
    assert.strictEqual(boba150.formattedQuantity, '1.5', '150 / 100 = 1.5 boba teas')

    // Single item handling (singular label)
    const singleSamosa = convertToUnit(20, 'samosas')
    assert.strictEqual(singleSamosa.formattedQuantity, '1')
    assert.strictEqual(singleSamosa.label, 'samosa', 'Should use singular label for 1 unit')

    // Large spend: ₹1,200
    const largeBoba = convertToUnit(1200, 'boba')
    assert.strictEqual(largeBoba.formattedQuantity, '12')
    assert.strictEqual(largeBoba.label, 'boba teas')

    // Fractional spend: ₹35
    const fractionalSamosa = convertToUnit(35, 'samosas')
    assert.strictEqual(fractionalSamosa.formattedQuantity, '1.8', '35 / 20 = 1.75 -> rounded sensibly to 1.8')

    // Zero spend
    const zeroSpend = convertToUnit(0, 'samosas')
    assert.strictEqual(zeroSpend.formattedQuantity, '0')
  })

  // =========================================================================
  // SCENARIO 5: DIFFERENT CONFIGURED UNIT PRICES
  // =========================================================================
  test('Scenario 5: Dynamic calculation when custom unit prices are configured', () => {
    // Custom price: samosa at ₹25 instead of default ₹20
    const customSamosa = convertToUnit(500, 'samosas', { samosas: 25 })
    assert.strictEqual(customSamosa.unitPrice, 25)
    assert.strictEqual(customSamosa.formattedQuantity, '20', '500 / 25 = 20 samosas')

    // Custom price: boba at ₹125 instead of default ₹100
    const customBoba = convertToUnit(500, 'boba', { boba: 125 })
    assert.strictEqual(customBoba.unitPrice, 125)
    assert.strictEqual(customBoba.formattedQuantity, '4', '500 / 125 = 4 boba teas')

    // Multiple custom prices together
    const allCustom = calculateRelatableUnits(600, { samosas: 30, boba: 150 })
    const samosaUnit = allCustom.find(u => u.id === 'samosas')
    const bobaUnit = allCustom.find(u => u.id === 'boba')

    assert.strictEqual(samosaUnit.formattedQuantity, '20', '600 / 30 = 20 samosas')
    assert.strictEqual(bobaUnit.formattedQuantity, '4', '600 / 150 = 4 boba teas')
  })

  // =========================================================================
  // SCENARIO 6: WEEKLY REMAINING BUDGET CALCULATION
  // =========================================================================
  test('Scenario 6: Weekly remaining budget calculation: ₹2,000 budget - ₹500 spent = ₹1,500 left (25%)', () => {
    const todayStr = '2026-11-09'
    const testTransactions = [
      { id: 101, type: 'EXPENSE', amount: -300, date: todayStr },
      { id: 102, type: 'EXPENSE', amount: -200, date: todayStr }
    ]

    const stats = calculateWeeklyBudgetStats({
      weeklyBudget: 2000,
      transactions: testTransactions,
      referenceDate: todayStr
    })

    assert.strictEqual(stats.hasBudget, true)
    assert.strictEqual(stats.weeklyBudget, 2000)
    assert.strictEqual(stats.spent, 500, 'Total spent should be 300 + 200 = 500')
    assert.strictEqual(stats.remaining, 1500, 'Remaining should be 2000 - 500 = 1500')
    assert.strictEqual(stats.progressPercent, 25, 'Progress should be 25%')
    assert.strictEqual(stats.isOverBudget, false)
    assert.strictEqual(stats.overspentAmount, 0)
    assert.strictEqual(stats.txCount, 2)
  })

  // =========================================================================
  // SCENARIO 7: EXPENSE ADDED AFTER PAGE LOAD
  // =========================================================================
  test('Scenario 7: Expense added dynamically updates spent, remaining, and progress', () => {
    const todayStr = '2026-11-09'
    const initialTxs = [
      { id: 101, type: 'EXPENSE', amount: -500, date: todayStr }
    ]

    const initialStats = calculateWeeklyBudgetStats({
      weeklyBudget: 2000,
      transactions: initialTxs,
      referenceDate: todayStr
    })
    assert.strictEqual(initialStats.spent, 500)
    assert.strictEqual(initialStats.remaining, 1500)
    assert.strictEqual(initialStats.progressPercent, 25)

    // User lodges a new spend of ₹300
    const updatedTxs = [
      ...initialTxs,
      { id: 102, type: 'EXPENSE', amount: -300, date: todayStr }
    ]

    const updatedStats = calculateWeeklyBudgetStats({
      weeklyBudget: 2000,
      transactions: updatedTxs,
      referenceDate: todayStr
    })
    assert.strictEqual(updatedStats.spent, 800)
    assert.strictEqual(updatedStats.remaining, 1200)
    assert.strictEqual(updatedStats.progressPercent, 40)
    assert.strictEqual(updatedStats.txCount, 2)
  })

  // =========================================================================
  // SCENARIO 8: EXPENSE DELETED OR EDITED
  // =========================================================================
  test('Scenario 8: Deleting or correcting an expense recalculates remaining budget cleanly', () => {
    const todayStr = '2026-11-09'
    const txsWithMistake = [
      { id: 1, type: 'EXPENSE', amount: -400, date: todayStr },
      { id: 2, type: 'EXPENSE', amount: -600, date: todayStr } // accidental duplicate
    ]

    const beforeDelete = calculateWeeklyBudgetStats({
      weeklyBudget: 2000,
      transactions: txsWithMistake,
      referenceDate: todayStr
    })
    assert.strictEqual(beforeDelete.spent, 1000)
    assert.strictEqual(beforeDelete.remaining, 1000)

    // Delete transaction id 2
    const afterDeleteTxs = txsWithMistake.filter(t => t.id !== 2)
    const afterDelete = calculateWeeklyBudgetStats({
      weeklyBudget: 2000,
      transactions: afterDeleteTxs,
      referenceDate: todayStr
    })
    assert.strictEqual(afterDelete.spent, 400)
    assert.strictEqual(afterDelete.remaining, 1600)
    assert.strictEqual(afterDelete.progressPercent, 20)
  })

  // =========================================================================
  // SCENARIO 9: WEEKLY BUDGET EXCEEDED (OVERSPENT STATE)
  // =========================================================================
  test('Scenario 9: Spending exceeds budget: shows overspent amount, never negative money as available', () => {
    const todayStr = '2026-11-09'
    const overspentTxs = [
      { id: 1, type: 'EXPENSE', amount: -1500, date: todayStr },
      { id: 2, type: 'EXPENSE', amount: -800, date: todayStr }
    ] // Total: ₹2,300 on a ₹2,000 budget

    const stats = calculateWeeklyBudgetStats({
      weeklyBudget: 2000,
      transactions: overspentTxs,
      referenceDate: todayStr
    })

    assert.strictEqual(stats.spent, 2300)
    assert.strictEqual(stats.weeklyBudget, 2000)
    assert.strictEqual(stats.isOverBudget, true, 'isOverBudget must be true')
    assert.strictEqual(stats.overspentAmount, 300, 'Overspent by 2300 - 2000 = 300')
    assert.strictEqual(stats.remaining, 0, 'Remaining MUST be 0, never negative money')
    assert.strictEqual(stats.progressPercent, 115, 'Progress is 115%')
  })

  // =========================================================================
  // SCENARIO 10: NO WEEKLY BUDGET CONFIGURED
  // =========================================================================
  test('Scenario 10: No weekly budget configured flags unconfigured state without inventing numbers', () => {
    const nullBudgetStats = calculateWeeklyBudgetStats({
      weeklyBudget: null,
      transactions: [{ id: 1, type: 'EXPENSE', amount: -100, date: '2026-11-09' }]
    })
    assert.strictEqual(nullBudgetStats.hasBudget, false)
    assert.strictEqual(nullBudgetStats.weeklyBudget, 0)
    assert.strictEqual(nullBudgetStats.remaining, 0)

    const zeroBudgetStats = calculateWeeklyBudgetStats({
      weeklyBudget: 0,
      transactions: []
    })
    assert.strictEqual(zeroBudgetStats.hasBudget, false)

    // Verify WeeklyBudgetCard displays prompt state
    const cardPath = path.join(rootDir, 'src', 'components', 'WeeklyBudgetCard.jsx')
    const cardContent = fs.readFileSync(cardPath, 'utf8')
    assert.ok(cardContent.includes('!hasBudget'), 'Must handle unconfigured state')
    assert.ok(cardContent.includes('Set Your Weekly Budget'), 'Must invite user to configure budget')
    assert.ok(cardContent.includes('budget-preset-chip'), 'Must provide quick budget presets')
  })

  // =========================================================================
  // SCENARIO 11: REFRESH AND DATA PERSISTENCE
  // =========================================================================
  test('Scenario 11: Backend endpoints GET /api/budget and PATCH /api/budget persist budget correctly', async () => {
    // Read server file and ensure routes exist
    const serverPath = path.join(rootDir, 'server', 'index.js')
    const serverCode = fs.readFileSync(serverPath, 'utf8')

    assert.ok(serverCode.includes("path === '/api/budget'"), 'Server must have /api/budget endpoint')
    assert.ok(serverCode.includes("req.method === 'PATCH' && path === '/api/budget'"), 'Must handle PATCH /api/budget')
    assert.ok(serverCode.includes("req.method === 'GET' && path === '/api/budget'"), 'Must handle GET /api/budget')
    assert.ok(serverCode.includes('db.profile.weeklyBudget'), 'Must persist weeklyBudget in profile DB')
  })

  // =========================================================================
  // SCENARIO 12: GOAL CONTRIBUTIONS DO NOT COUNT AS EXPENSES
  // =========================================================================
  test('Scenario 12: Goal contributions and wallet transfers are strictly excluded from spending', () => {
    const todayStr = '2026-11-09'
    const mixedTransactions = [
      { id: 1, type: 'EXPENSE', amount: -400, title: 'Bookstore', category: 'Education', date: todayStr },
      { id: 2, type: 'GOAL_CONTRIBUTION', amount: -1000, title: 'Sneakers Goal', category: 'Goals', goalId: 'goal_1', date: todayStr },
      { id: 3, type: 'GOAL_WITHDRAWAL', amount: 400, title: 'Goal refund', category: 'Goals', goalId: 'goal_1', isGoalWithdrawal: true, date: todayStr },
      { id: 4, type: 'MONEY_ADDED', amount: 500, title: 'Pocket money', category: 'Income', date: todayStr },
      { id: 5, type: 'PARENT_APPROVAL_LOCKED', amount: 800, title: 'Parent approved locked fund', date: todayStr }
    ]

    // Verify qualification function directly
    assert.strictEqual(isQualifyingExpense(mixedTransactions[0]), true, 'Bookstore is a qualifying expense')
    assert.strictEqual(isQualifyingExpense(mixedTransactions[1]), false, 'GOAL_CONTRIBUTION must NOT be an expense')
    assert.strictEqual(isQualifyingExpense(mixedTransactions[2]), false, 'GOAL_WITHDRAWAL must NOT be an expense')
    assert.strictEqual(isQualifyingExpense(mixedTransactions[3]), false, 'MONEY_ADDED must NOT be an expense')
    assert.strictEqual(isQualifyingExpense(mixedTransactions[4]), false, 'PARENT_APPROVAL_LOCKED must NOT be an expense')

    // Verify budget stats
    const stats = calculateWeeklyBudgetStats({
      weeklyBudget: 2000,
      transactions: mixedTransactions,
      referenceDate: todayStr
    })

    assert.strictEqual(stats.spent, 400, 'Only the ₹400 Bookstore expense should be counted')
    assert.strictEqual(stats.remaining, 1600, '2000 - 400 = 1600')
    assert.strictEqual(stats.progressPercent, 20)
    assert.strictEqual(stats.txCount, 1, 'Only 1 qualifying transaction')
  })
})
