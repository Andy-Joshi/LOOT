import assert from 'node:assert'
import { test, describe } from 'node:test'
import fs from 'node:fs'
import path from 'node:path'

describe('LOOT Money Engine UI Components & Integration Verification', () => {
  const rootDir = process.cwd()

  test('WalletOnboardingModal has correct headlines, INR input, validation and presets', () => {
    const modalPath = path.join(rootDir, 'src/components/WalletOnboardingModal.jsx')
    assert.ok(fs.existsSync(modalPath), 'WalletOnboardingModal.jsx must exist')
    const content = fs.readFileSync(modalPath, 'utf8')

    assert.ok(content.includes("Let's set up your wallet."), 'Must contain required headline')
    assert.ok(content.includes("How much money do you currently have?"), 'Must contain required subtitle')
    assert.ok(content.includes('onboarding-inr-input'), 'Must contain prominent INR input field')
    assert.ok(content.includes('setOnboardingOpeningBalance'), 'Must call setOnboardingOpeningBalance on submission')
    assert.ok(content.includes('Fresh Start (₹0)'), 'Must include ₹0 preset option')
  })

  test('OverspendingConfirmModal has required headline, 3-stat breakdown, and actions', () => {
    const modalPath = path.join(rootDir, 'src/components/OverspendingConfirmModal.jsx')
    assert.ok(fs.existsSync(modalPath), 'OverspendingConfirmModal.jsx must exist')
    const content = fs.readFileSync(modalPath, 'utf8')

    assert.ok(content.includes("Whoa! You're going beyond your balance."), 'Must contain required headline')
    assert.ok(content.includes('Available Balance'), 'Must show available balance')
    assert.ok(content.includes('Requested Spend'), 'Must show requested spend')
    assert.ok(content.includes('Shortfall Deficit'), 'Must show shortfall deficit')
    assert.ok(content.includes('Cancel Transaction'), 'Must offer Cancel Transaction action')
    assert.ok(content.includes('Continue Anyway'), 'Must offer Continue Anyway action')
  })

  test('OutstandingShortfallCard renders positive settled state and active deficit state', () => {
    const cardPath = path.join(rootDir, 'src/components/OutstandingShortfallCard.jsx')
    assert.ok(fs.existsSync(cardPath), 'OutstandingShortfallCard.jsx must exist')
    const content = fs.readFileSync(cardPath, 'utf8')

    assert.ok(content.includes('All Balanced & Cleared'), 'Must contain positive settled state description')
    assert.ok(content.includes('100% BALANCED'), 'Must contain balanced badge')
    assert.ok(content.includes('ACTION NEEDED'), 'Must contain action needed badge for deficit')
    assert.ok(content.includes('shortfall-track-fill'), 'Must contain settlement progress bar')
  })

  test('ShortfallsSection supports filtering, sorting, manual settlement and genuine loans', () => {
    const sectionPath = path.join(rootDir, 'src/components/ShortfallsSection.jsx')
    assert.ok(fs.existsSync(sectionPath), 'ShortfallsSection.jsx must exist')
    const content = fs.readFileSync(sectionPath, 'utf8')

    assert.ok(content.includes('settleShortfallManually'), 'Must support manual settlement')
    assert.ok(content.includes('recordBorrowedLoan'), 'Must support recording genuine loans')
    assert.ok(content.includes('filter === \'loan\''), 'Must filter by genuine loans')
    assert.ok(content.includes('Lender Name (Required)'), 'Must enforce explicit lender on genuine loans')
    assert.ok(content.includes('Never invent a person or creditor'), 'Must distinguish overspend from loan')
  })

  test('App.jsx integrates central balance calculation across Dashboard, Money Lab, and Modals', () => {
    const appPath = path.join(rootDir, 'src/App.jsx')
    const content = fs.readFileSync(appPath, 'utf8')

    assert.ok(content.includes('WalletOnboardingModal'), 'App.jsx must import WalletOnboardingModal')
    assert.ok(content.includes('OverspendingConfirmModal'), 'App.jsx must import OverspendingConfirmModal')
    assert.ok(content.includes('OutstandingShortfallCard'), 'App.jsx must import OutstandingShortfallCard')
    assert.ok(content.includes('ShortfallsSection'), 'App.jsx must import ShortfallsSection')
    assert.ok(content.includes('checkExpenseOverspend'), 'App.jsx must check overspending before lodging expense')
    assert.ok(content.includes('subscribeMoneyEngine'), 'App.jsx must subscribe to central money engine')
    assert.ok(content.includes('accountingState.availableBalance'), 'App.jsx must read balance from central money engine')
    assert.ok(!content.includes('totals.income + 18420 - totals.spent'), 'App.jsx must NOT use hardcoded 18420 balance formula')
  })

  test('CustomizeProfileModal includes auditable opening balance adjustments', () => {
    const profileModalPath = path.join(rootDir, 'src/components/CustomizeProfileModal.jsx')
    const content = fs.readFileSync(profileModalPath, 'utf8')

    assert.ok(content.includes('adjustOpeningBalance'), 'Must import adjustOpeningBalance')
    assert.ok(content.includes('CENTRAL MONEY ENGINE'), 'Must display money engine section')
    assert.ok(content.includes('Edit Opening Balance'), 'Must provide edit opening balance trigger')
    assert.ok(content.includes('Audit Reason'), 'Must require/prompt reason for auditable trail')
  })
})
