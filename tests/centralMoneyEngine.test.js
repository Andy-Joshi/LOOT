import assert from 'node:assert'
import { test, describe, beforeEach } from 'node:test'
import {
  _resetMemoryStoreForTesting,
  setOnboardingOpeningBalance,
  getCentralAccountingState,
  checkExpenseOverspend,
  recordTransaction,
  adjustOpeningBalance,
  settleShortfallManually,
  recordBorrowedLoan
} from '../src/services/moneyEngine.js'

describe('LOOT Central Money Engine & Shortfall Accounting System', () => {
  beforeEach(() => {
    _resetMemoryStoreForTesting()
  })

  test('Scenario 1 & 2: First launch with ₹500 opening balance persists and establishes baseline', async () => {
    const res = await setOnboardingOpeningBalance(500)
    assert.strictEqual(res.openingBalance, 500)
    assert.strictEqual(res.onboardingCompleted, true)

    const state = await getCentralAccountingState()
    assert.strictEqual(state.openingBalance, 500)
    assert.strictEqual(state.availableBalance, 500)
    assert.strictEqual(state.outstandingShortfall, 0)
    assert.strictEqual(state.onboardingCompleted, true)
  })

  test('Scenario 3: Spend ₹100 and verify ₹400 remains available', async () => {
    await setOnboardingOpeningBalance(500)

    const overspendCheck = await checkExpenseOverspend(100)
    assert.strictEqual(overspendCheck.isOverspend, false)
    assert.strictEqual(overspendCheck.availableBalance, 500)

    await recordTransaction({
      title: 'Groceries and snacks',
      category: 'Lifestyle',
      amount: -100,
      isOverspend: false
    })

    const state = await getCentralAccountingState()
    assert.strictEqual(state.availableBalance, 400)
    assert.strictEqual(state.outstandingShortfall, 0)
    assert.strictEqual(state.totalExpenses, 100)
  })

  test('Scenario 4 & 5: Attempt to spend ₹450 when balance is ₹400; Cancel leaves balance unchanged', async () => {
    await setOnboardingOpeningBalance(500)
    await recordTransaction({ title: 'Spend 100', amount: -100 })

    const overspendCheck = await checkExpenseOverspend(450)
    assert.strictEqual(overspendCheck.isOverspend, true)
    assert.strictEqual(overspendCheck.availableBalance, 400)
    assert.strictEqual(overspendCheck.requestedAmount, 450)
    assert.strictEqual(overspendCheck.shortfallAmount, 50)

    // User cancels transaction -> no record created
    const state = await getCentralAccountingState()
    assert.strictEqual(state.availableBalance, 400, 'Balance must remain ₹400 after cancellation')
    assert.strictEqual(state.outstandingShortfall, 0, 'No shortfall recorded on cancel')
  })

  test('Scenario 6 & 7: Repeat and select Continue Anyway; verify ₹0 available and ₹50 outstanding shortfall', async () => {
    await setOnboardingOpeningBalance(500)
    await recordTransaction({ title: 'Spend 100', amount: -100 })

    const overspendCheck = await checkExpenseOverspend(450)
    assert.strictEqual(overspendCheck.isOverspend, true)

    // User selects Continue Anyway -> records transaction with isOverspend: true
    const result = await recordTransaction({
      title: 'Concert ticket',
      category: 'Experiences',
      amount: -450,
      isOverspend: true
    })

    assert.ok(result.shortfall, 'Shortfall record must be created')
    assert.strictEqual(result.shortfall.originalAmount, 50)
    assert.strictEqual(result.shortfall.remainingAmount, 50)
    assert.strictEqual(result.shortfall.status, 'outstanding')
    assert.strictEqual(result.shortfall.lender, null, 'Never invent a person or creditor')

    const state = await getCentralAccountingState()
    assert.strictEqual(state.availableBalance, 0, 'Available cash balance must be ₹0')
    assert.strictEqual(state.outstandingShortfall, 50, 'Outstanding shortfall must be ₹50')
    assert.strictEqual(state.shortfalls.length, 1)
  })

  test('Scenario 8 & 9: Add ₹200; verify auto-settlement of ₹50 shortfall leaves ₹150 available and ₹0 outstanding', async () => {
    await setOnboardingOpeningBalance(500)
    await recordTransaction({ title: 'Spend 100', amount: -100 })
    await recordTransaction({ title: 'Concert ticket', amount: -450, isOverspend: true })

    // Verify intermediate state
    let state = await getCentralAccountingState()
    assert.strictEqual(state.availableBalance, 0)
    assert.strictEqual(state.outstandingShortfall, 50)

    // User receives ₹200 (allowance / income)
    const incomeRes = await recordTransaction({
      title: 'Weekly Allowance',
      category: 'Income',
      amount: 200
    })

    assert.strictEqual(incomeRes.transaction.appliedToShortfalls, 50)
    assert.strictEqual(incomeRes.transaction.creditedToAvailable, 150)

    state = await getCentralAccountingState()
    assert.strictEqual(state.availableBalance, 150, 'Available balance must be ₹150')
    assert.strictEqual(state.outstandingShortfall, 0, 'Outstanding shortfall must be ₹0')

    const settledSf = state.shortfalls.find(s => s.id === incomeRes.settlementAllocations[0].shortfallId)
    assert.strictEqual(settledSf.status, 'settled')
    assert.strictEqual(settledSf.remainingAmount, 0)
    assert.strictEqual(settledSf.settledAmount, 50)
    assert.strictEqual(settledSf.settlements.length, 1)
  })

  test('Scenario 10: Refresh and verify all records remain correct without counting money twice', async () => {
    await setOnboardingOpeningBalance(500)
    await recordTransaction({ title: 'Spend 100', amount: -100 })
    await recordTransaction({ title: 'Concert ticket', amount: -450, isOverspend: true })
    await recordTransaction({ title: 'Weekly Allowance', amount: 200 })

    // Re-fetch central accounting state (simulating page reload)
    const state = await getCentralAccountingState()
    assert.strictEqual(state.openingBalance, 500)
    assert.strictEqual(state.availableBalance, 150)
    assert.strictEqual(state.outstandingShortfall, 0)
    assert.strictEqual(state.totalShortfallSettled, 50)
    assert.strictEqual(state.totalIncome, 200)
    assert.strictEqual(state.totalExpenses, 550)
  })

  test('Scenario 11: Multiple shortfalls settled chronologically (FIFO)', async () => {
    await setOnboardingOpeningBalance(0)

    // Two overspend expenses
    await recordTransaction({ title: 'Book purchase', amount: -60, isOverspend: true })
    await recordTransaction({ title: 'Dinner out', amount: -40, isOverspend: true })

    let state = await getCentralAccountingState()
    assert.strictEqual(state.availableBalance, 0)
    assert.strictEqual(state.outstandingShortfall, 100)
    assert.strictEqual(state.shortfalls.length, 2)

    // Receive ₹75 income: should settle first shortfall (₹60) and ₹15 of second shortfall (₹25 remaining)
    await recordTransaction({ title: 'Odd job earnings', amount: 75 })

    state = await getCentralAccountingState()
    assert.strictEqual(state.availableBalance, 0)
    assert.strictEqual(state.outstandingShortfall, 25)

    const sf1 = state.shortfalls.find(s => s.title.includes('Book purchase'))
    const sf2 = state.shortfalls.find(s => s.title.includes('Dinner out'))
    assert.strictEqual(sf1.status, 'settled')
    assert.strictEqual(sf1.remainingAmount, 0)
    assert.strictEqual(sf2.status, 'partially_settled')
    assert.strictEqual(sf2.remainingAmount, 25)

    // Receive ₹50 income: settles remaining ₹25, leaves ₹25 in available balance
    await recordTransaction({ title: 'Gift money', amount: 50 })

    state = await getCentralAccountingState()
    assert.strictEqual(state.availableBalance, 25)
    assert.strictEqual(state.outstandingShortfall, 0)
    assert.strictEqual(sf2.remainingAmount, 0)
    assert.strictEqual(sf2.status, 'settled')
  })

  test('Scenario 12: Genuine loans require explicit lender and track independently from overdraft shortfalls', async () => {
    await setOnboardingOpeningBalance(100)

    // Missing lender should throw
    await assert.rejects(async () => {
      await recordBorrowedLoan({ lender: '', amount: 300 })
    }, /Lender name is required/)

    // Record legitimate loan from "Dad"
    const loan = await recordBorrowedLoan({
      lender: 'Dad',
      amount: 300,
      purpose: 'Emergency bike repair'
    })

    assert.strictEqual(loan.lender, 'Dad')
    assert.strictEqual(loan.originalAmount, 300)
    assert.strictEqual(loan.remainingAmount, 300)

    const state = await getCentralAccountingState()
    // Available balance received loan inflow: 100 + 300 = 400
    assert.strictEqual(state.availableBalance, 400)
    assert.strictEqual(state.loans.length, 1)
    assert.strictEqual(state.outstandingShortfall, 300)
  })

  test('Scenario 13: Auditable opening balance adjustment records immutable audit log', async () => {
    await setOnboardingOpeningBalance(200)

    // Edit opening balance from 200 to 350
    const adj = await adjustOpeningBalance(350, 'Bank reconciliation after statement')
    assert.strictEqual(adj.previousAmount, 200)
    assert.strictEqual(adj.newAmount, 350)
    assert.strictEqual(adj.difference, 150)

    const state = await getCentralAccountingState()
    assert.strictEqual(state.openingBalance, 350)
    assert.strictEqual(state.availableBalance, 350)
    assert.strictEqual(state.adjustments.length, 1)

    // Ledger must contain audit transaction
    const adjTx = state.transactions.find(t => t.category === 'Adjustment')
    assert.ok(adjTx)
    assert.strictEqual(adjTx.amount, 150)
  })

  test('Scenario 14: Manual shortfall settlement from external cash settles shortfall', async () => {
    await setOnboardingOpeningBalance(100)
    const tx = await recordTransaction({ title: 'Big purchase', amount: -250, isOverspend: true })
    const sfId = tx.shortfall.id

    let state = await getCentralAccountingState()
    assert.strictEqual(state.availableBalance, 0)
    assert.strictEqual(state.outstandingShortfall, 150)

    // Manually settle ₹150 with external cash
    const settledSf = await settleShortfallManually(sfId, 150, 'external')
    assert.strictEqual(settledSf.status, 'settled')
    assert.strictEqual(settledSf.remainingAmount, 0)
    assert.strictEqual(settledSf.settledAmount, 150)

    state = await getCentralAccountingState()
    assert.strictEqual(state.outstandingShortfall, 0)
  })
})
