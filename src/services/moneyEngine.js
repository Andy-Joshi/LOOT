/**
 * LOOT Central Money Engine & IndexedDB Service
 *
 * Implements:
 * 1. Persistent IndexedDB accounting storage (loot_money_db) with in-memory fallback for Node test runner.
 * 2. First-launch opening balance setup & auditable adjustments.
 * 3. Central available balance calculation (single source of truth for all components).
 * 4. Overspending detection & confirmation mechanism (sets cash to 0, logs shortfall).
 * 5. Automatic FIFO shortfall settlement when new money arrives (incoming funds settle shortfalls first).
 * 6. Manual shortfall settlement and genuine loan tracking (with explicit lenders).
 * 7. Reactive event subscriptions for instantaneous UI updates across all components.
 */

const DB_NAME = 'loot_money_db'
const DB_VERSION = 1

// In-memory store fallback when running in Node.js or SSR
let memoryStore = {
  settings: {
    openingBalance: 0,
    onboardingCompleted: false,
    openingBalanceDate: null,
    adjustments: []
  },
  transactions: [],
  shortfalls: [],
  loans: []
}

let dbInstance = null
const subscribers = new Set()

/**
 * Checks if IndexedDB is supported in the current environment
 */
const hasIndexedDB = () => {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined'
}

/**
 * Opens or initializes the IndexedDB database
 */
export const openMoneyDB = () => {
  return new Promise((resolve) => {
    if (!hasIndexedDB()) {
      return resolve(null) // Use memory store fallback
    }

    if (dbInstance) {
      return resolve(dbInstance)
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result

      // 1. Settings store (Opening balance, onboarding flag, adjustments)
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' })
      }

      // 2. Transactions ledger store
      if (!db.objectStoreNames.contains('transactions')) {
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
        txStore.createIndex('date', 'date', { unique: false })
        txStore.createIndex('timestamp', 'timestamp', { unique: false })
        txStore.createIndex('category', 'category', { unique: false })
      }

      // 3. Shortfalls store
      if (!db.objectStoreNames.contains('shortfalls')) {
        const sfStore = db.createObjectStore('shortfalls', { keyPath: 'id' })
        sfStore.createIndex('status', 'status', { unique: false })
        sfStore.createIndex('type', 'type', { unique: false })
        sfStore.createIndex('timestamp', 'timestamp', { unique: false })
      }

      // 4. Loans store (genuine loans with explicit lenders)
      if (!db.objectStoreNames.contains('loans')) {
        const loanStore = db.createObjectStore('loans', { keyPath: 'id' })
        loanStore.createIndex('lender', 'lender', { unique: false })
        loanStore.createIndex('status', 'status', { unique: false })
      }
    }

    request.onsuccess = (event) => {
      dbInstance = event.target.result
      resolve(dbInstance)
    }

    request.onerror = (event) => {
      console.warn('IndexedDB open error, falling back to in-memory store:', event.target.error)
      resolve(null)
    }
  })
}

/**
 * Read all records from a given IndexedDB object store
 */
const getAllFromStore = async (storeName) => {
  const db = await openMoneyDB()
  if (!db) {
    if (storeName === 'settings') {
      return Object.entries(memoryStore.settings).map(([key, value]) => ({ key, value }))
    }
    return memoryStore[storeName] || []
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readonly')
      const store = tx.objectStore(storeName)
      const req = store.getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => resolve([])
    } catch {
      resolve([])
    }
  })
}

/**
 * Put an item into a given IndexedDB object store
 */
const putInStore = async (storeName, item) => {
  const db = await openMoneyDB()
  if (!db) {
    if (storeName === 'settings') {
      memoryStore.settings[item.key] = item.value
    } else {
      const list = memoryStore[storeName] || []
      const idx = list.findIndex(x => x.id === item.id)
      if (idx >= 0) list[idx] = item
      else list.push(item)
    }
    return item
  }

  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.put(item)
      req.onsuccess = () => resolve(item)
      req.onerror = () => reject(req.error)
    } catch (err) {
      reject(err)
    }
  })
}

/**
 * Delete an item from a given IndexedDB object store
 */
export const deleteFromStore = async (storeName, id) => {
  const db = await openMoneyDB()
  if (!db) {
    if (storeName === 'settings') {
      delete memoryStore.settings[id]
    } else {
      memoryStore[storeName] = (memoryStore[storeName] || []).filter(x => x.id !== id)
    }
    return true
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(storeName, 'readwrite')
      const store = tx.objectStore(storeName)
      const req = store.delete(id)
      req.onsuccess = () => resolve(true)
      req.onerror = () => resolve(false)
    } catch {
      resolve(false)
    }
  })
}

/**
 * Subscribe to central accounting state changes
 */
export const subscribeMoneyEngine = (listener) => {
  subscribers.add(listener)
  return () => subscribers.delete(listener)
}

const notifySubscribers = async () => {
  const state = await getCentralAccountingState()
  subscribers.forEach(listener => {
    try {
      listener(state)
    } catch (err) {
      console.error('Money engine listener error:', err)
    }
  })
}

/**
 * Central Balance & Accounting Calculation Service
 *
 * Implements strict financial separation:
 * - Available Balance: Money available for spending.
 * - Goal Savings: Money allocated to active savings goals.
 * - Locked Funds: Parent-approved funds awaiting receipt confirmation (cannot be spent or withdrawn).
 * - Total Owned Money: Available Balance + Goal Savings (excludes locked parent funds).
 *
 * Chronological transaction simulation handles:
 * - MONEY_ADDED: Inflow / income with FIFO shortfall settlement.
 * - EXPENSE: Outflow with overspend protection.
 * - GOAL_CONTRIBUTION: Deducts from available balance into goal savings.
 * - GOAL_WITHDRAWAL: Returns money to available balance (never treated as income).
 * - PARENT_APPROVAL_LOCKED: Locks funds awaiting receipt confirmation.
 * - PARENT_FUNDS_UNLOCKED: Releases locked parent funds.
 * - PARENT_APPROVAL_EXPIRED: Cleans up expired parent approval locks.
 */
export const getCentralAccountingState = async (options = {}) => {
  const settingsList = await getAllFromStore('settings')
  const settingsMap = {}
  settingsList.forEach(item => {
    settingsMap[item.key] = item.value
  })

  const openingBalance = Number(settingsMap.openingBalance) || 0
  const onboardingCompleted = Boolean(settingsMap.onboardingCompleted)
  const adjustments = settingsMap.adjustments || []

  // Net adjustments from opening balance edits
  const totalAdjustments = adjustments.reduce((sum, adj) => sum + (Number(adj.difference) || 0), 0)

  const rawTransactions = await getAllFromStore('transactions')
  const transactions = [...rawTransactions].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  const rawShortfalls = await getAllFromStore('shortfalls')
  const shortfalls = [...rawShortfalls].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  const rawLoans = await getAllFromStore('loans')
  const loans = [...rawLoans].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  // Total Outstanding Shortfall (remainingAmount on all un-settled shortfalls)
  const outstandingShortfall = shortfalls
    .filter(sf => sf.status !== 'settled')
    .reduce((sum, sf) => sum + (Number(sf.remainingAmount) || 0), 0)

  const totalShortfallOriginal = shortfalls.reduce((sum, sf) => sum + (Number(sf.originalAmount) || 0), 0)
  const totalShortfallSettled = shortfalls.reduce((sum, sf) => sum + (Number(sf.settledAmount) || 0), 0)

  // Chronological balance simulation to compute exact available balance
  const chronologicalTxs = [...rawTransactions].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))

  // Opening balance is the baseline (reflecting any auditable opening adjustments)
  let availableCash = openingBalance
  let ledgerGoalSavings = 0
  let ledgerLockedFunds = 0

  // Track shortfalls state chronologically
  const activeShortfallsMap = new Map()

  for (const tx of chronologicalTxs) {
    if (tx.isAdjustment) {
      // Audit entry for opening balance adjustment; openingBalance already reflects this
      continue
    }

    const amt = Number(tx.amount) || 0
    const rawType = tx.type ? String(tx.type).toUpperCase() : null

    // Determine normalized transaction type
    let txType = rawType
    if (!txType) {
      if (amt < 0) txType = 'EXPENSE'
      else if (amt > 0) txType = 'MONEY_ADDED'
    }

    // 1. GOAL CONTRIBUTION: Deducts money from available balance, moves into goal savings
    if (txType === 'GOAL_CONTRIBUTION') {
      const contribAmt = Math.abs(amt)
      availableCash = Math.max(0, availableCash - contribAmt)
      ledgerGoalSavings += contribAmt
      continue
    }

    // 2. GOAL WITHDRAWAL: Returns money from goal savings to available balance (NOT treated as income)
    if (txType === 'GOAL_WITHDRAWAL') {
      const withdrAmt = Math.abs(amt)
      availableCash += withdrAmt
      ledgerGoalSavings = Math.max(0, ledgerGoalSavings - withdrAmt)
      continue
    }

    // 3. PARENT APPROVAL LOCKED: Locked funds awaiting receipt confirmation (NOT available for spend)
    if (txType === 'PARENT_APPROVAL_LOCKED') {
      const lockedAmt = Math.abs(amt)
      ledgerLockedFunds += lockedAmt
      continue
    }

    // 4. PARENT FUNDS UNLOCKED: Approved parent funds verified / unlocked
    if (txType === 'PARENT_FUNDS_UNLOCKED') {
      const unlockedAmt = Math.abs(amt)
      ledgerLockedFunds = Math.max(0, ledgerLockedFunds - unlockedAmt)
      if (tx.creditAvailable) {
        availableCash += unlockedAmt
      }
      continue
    }

    // 5. PARENT APPROVAL EXPIRED: Expired parent approval
    if (txType === 'PARENT_APPROVAL_EXPIRED') {
      const expiredAmt = Math.abs(amt)
      ledgerLockedFunds = Math.max(0, ledgerLockedFunds - expiredAmt)
      continue
    }

    // 6. EXPENSE: Outflow
    if (txType === 'EXPENSE' || amt < 0) {
      const expenseAmt = Math.abs(amt)
      if (tx.isOverspend) {
        // Exceeded balance: available cash was drained to 0
        availableCash = 0
        if (tx.shortfallId) {
          activeShortfallsMap.set(tx.shortfallId, tx.shortfallAmount || (expenseAmt - availableCash))
        }
      } else {
        availableCash = Math.max(0, availableCash - expenseAmt)
      }
      continue
    }

    // 7. MONEY_ADDED / INCOME: Inflow (FIFO shortfall settlement)
    if (txType === 'MONEY_ADDED' || amt > 0) {
      let incoming = amt

      // Applied to outstanding shortfalls first (FIFO)
      if (tx.settlementAllocations && tx.settlementAllocations.length > 0) {
        const settledSum = tx.settlementAllocations.reduce((s, a) => s + a.amount, 0)
        incoming = Math.max(0, incoming - settledSum)
      } else {
        // If not explicit in record, simulate FIFO deduction
        for (const [sfId, remaining] of activeShortfallsMap.entries()) {
          if (incoming <= 0) break
          if (remaining > 0) {
            const deduction = Math.min(incoming, remaining)
            const newRem = remaining - deduction
            if (newRem <= 0) activeShortfallsMap.delete(sfId)
            else activeShortfallsMap.set(sfId, newRem)
            incoming -= deduction
          }
        }
      }

      availableCash += incoming
      continue
    }
  }

  // Handle manual shortfall settlements from cash
  shortfalls.forEach(sf => {
    (sf.settlements || []).forEach(settlement => {
      if (settlement.paymentSource === 'available_cash') {
        availableCash = Math.max(0, availableCash - Number(settlement.amount || 0))
      }
    })
  })

  // Ensure cash cannot be negative
  availableCash = Math.max(0, Math.round(availableCash * 100) / 100)

  // Goal savings resolution: If goals array is provided, sum goal.saved; otherwise use ledger
  let goalSavings = ledgerGoalSavings
  if (Array.isArray(options.goals)) {
    goalSavings = options.goals.reduce((sum, g) => sum + Math.max(0, Number(g.saved) || 0), 0)
  }
  goalSavings = Math.max(0, Math.round(goalSavings * 100) / 100)

  // Locked funds resolution: If parentRequests is provided, sum approved & unexpired requests; otherwise use ledger
  let lockedFunds = ledgerLockedFunds
  if (Array.isArray(options.parentRequests)) {
    const nowTime = options.now ? new Date(options.now).getTime() : Date.now()
    lockedFunds = options.parentRequests
      .filter(pr => {
        const isApproved = pr.status === 'approved'
        const isExpired = pr.expires_at && new Date(pr.expires_at).getTime() < nowTime
        return isApproved && !isExpired
      })
      .reduce((sum, pr) => sum + (Number(pr.requested_amount) || 0), 0)
  }
  lockedFunds = Math.max(0, Math.round(lockedFunds * 100) / 100)

  // Total Owned Money: Available Balance + Goal Savings (locked parent funds are separate)
  const totalOwnedMoney = Math.max(0, Math.round((availableCash + goalSavings) * 100) / 100)

  const totalIncome = transactions
    .filter(t => {
      const type = t.type ? String(t.type).toUpperCase() : null
      if (type === 'GOAL_WITHDRAWAL' || type === 'GOAL_CONTRIBUTION' || type === 'PARENT_APPROVAL_LOCKED' || type === 'PARENT_APPROVAL_EXPIRED') {
        return false
      }
      return Number(t.amount) > 0 && !t.isAdjustment
    })
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalExpenses = transactions
    .filter(t => {
      const type = t.type ? String(t.type).toUpperCase() : null
      if (type === 'GOAL_CONTRIBUTION' || type === 'GOAL_WITHDRAWAL' || type === 'PARENT_APPROVAL_LOCKED' || type === 'PARENT_APPROVAL_EXPIRED') {
        return false
      }
      return Number(t.amount) < 0 && !t.isAdjustment
    })
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

  return {
    openingBalance,
    onboardingCompleted,
    adjustments,
    totalAdjustments,
    availableBalance: availableCash,
    goalSavings,
    lockedFunds,
    totalOwnedMoney,
    totalMoney: totalOwnedMoney, // alias for total owned money
    outstandingShortfall: Math.max(0, Math.round(outstandingShortfall * 100) / 100),
    totalShortfallOriginal,
    totalShortfallSettled,
    totalIncome,
    totalExpenses,
    transactions,
    shortfalls,
    loans
  }
}

/**
 * Initializes Opening Balance during First-Launch Onboarding
 */
export const setOnboardingOpeningBalance = async (amount) => {
  const validAmount = Math.max(0, Number(amount) || 0)
  const roundedAmount = Math.round(validAmount * 100) / 100

  await putInStore('settings', { key: 'openingBalance', value: roundedAmount })
  await putInStore('settings', { key: 'onboardingCompleted', value: true })
  await putInStore('settings', { key: 'openingBalanceDate', value: new Date().toISOString() })

  await notifySubscribers()
  return { openingBalance: roundedAmount, onboardingCompleted: true }
}

/**
 * Auditable Opening Balance Adjustment (available in Profile/Settings)
 */
export const adjustOpeningBalance = async (newAmount, reason = '') => {
  const currentState = await getCentralAccountingState()
  const currentOpening = currentState.openingBalance
  const parsedNew = Math.max(0, Number(newAmount) || 0)
  const roundedNew = Math.round(parsedNew * 100) / 100

  const diff = roundedNew - currentOpening
  const adjustmentRecord = {
    id: `adj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    previousAmount: currentOpening,
    newAmount: roundedNew,
    difference: diff,
    reason: reason.trim() || 'Manual balance adjustment',
    date: new Date().toISOString().slice(0, 10),
    timestamp: Date.now()
  }

  const existingAdjustments = currentState.adjustments || []
  const updatedAdjustments = [adjustmentRecord, ...existingAdjustments]

  await putInStore('settings', { key: 'openingBalance', value: roundedNew })
  await putInStore('settings', { key: 'adjustments', value: updatedAdjustments })

  // Log an auditable ledger entry for tracking
  await putInStore('transactions', {
    id: `tx_adj_${Date.now()}`,
    title: `Balance Adjustment: ${adjustmentRecord.reason}`,
    category: 'Adjustment',
    amount: diff,
    date: adjustmentRecord.date,
    timestamp: Date.now(),
    icon: diff >= 0 ? '⚖️' : '📉',
    isAdjustment: true,
    adjustmentId: adjustmentRecord.id
  })

  await notifySubscribers()
  return adjustmentRecord
}

/**
 * Evaluates whether an upcoming expense would exceed the available balance
 */
export const checkExpenseOverspend = async (expenseAmount) => {
  const state = await getCentralAccountingState()
  const amt = Math.abs(Number(expenseAmount) || 0)
  const available = state.availableBalance

  const isOverspend = amt > available
  const shortfallAmount = isOverspend ? Math.round((amt - available) * 100) / 100 : 0

  return {
    isOverspend,
    availableBalance: available,
    requestedAmount: amt,
    shortfallAmount
  }
}

/**
 * Records a transaction with first-class financial type support:
 * - MONEY_ADDED: Income / cash top-up (applies FIFO settlement to shortfalls).
 * - EXPENSE: Fiat spend.
 * - GOAL_CONTRIBUTION: Transfer from available balance to goal savings.
 * - GOAL_WITHDRAWAL: Transfer from goal savings back to available balance (never treated as income).
 * - PARENT_APPROVAL_LOCKED: Funds locked for parent pitch approval.
 * - PARENT_FUNDS_UNLOCKED: Funds released upon receipt verification.
 * - PARENT_APPROVAL_EXPIRED: Expired parent approval lock cleanup.
 */
export const recordTransaction = async ({
  title,
  category = 'Lifestyle',
  amount,
  isOverspend = false,
  date,
  icon,
  type = null,
  goalId = null,
  goalName = null,
  userId = 'rookie@example.com',
  description = null,
  requestId = null,
  pitchId = null,
  creditAvailable = false
}) => {
  const numAmount = Number(amount)
  if (isNaN(numAmount) || numAmount === 0) {
    throw new Error('Transaction amount must be a non-zero valid number.')
  }

  const currentState = await getCentralAccountingState()
  const txDate = date || new Date().toISOString().slice(0, 10)
  const timestamp = Date.now()
  const normalizedType = type ? String(type).toUpperCase() : null

  // 1. GOAL CONTRIBUTION: Deducts from available balance, moves into goal savings
  if (normalizedType === 'GOAL_CONTRIBUTION') {
    const contribAmt = Math.abs(numAmount)
    if (currentState.availableBalance < contribAmt) {
      throw new Error(`Insufficient available balance (₹${currentState.availableBalance}) to contribute ₹${contribAmt} to ${goalName || 'goal'}.`)
    }

    const txId = `tx_gc_${timestamp}_${Math.random().toString(36).slice(2, 6)}`
    const txTitle = title || `Added ₹${contribAmt.toLocaleString('en-IN')} to ${goalName || 'goal'}`
    const txDesc = description || `Added ₹${contribAmt.toLocaleString('en-IN')} to ${goalName || 'goal'} savings.`

    const transactionRecord = {
      id: txId,
      type: 'GOAL_CONTRIBUTION',
      title: txTitle,
      description: txDesc,
      category: 'Goals',
      amount: -contribAmt, // Outflow from available balance
      goalId: goalId ? String(goalId) : null,
      goalName: goalName || 'Goal',
      userId: String(userId || 'rookie@example.com'),
      date: txDate,
      timestamp,
      icon: icon || '🎯'
    }

    await putInStore('transactions', transactionRecord)
    await notifySubscribers()
    return { transaction: transactionRecord }
  }

  // 2. GOAL WITHDRAWAL: Returns money from goal savings to available balance (NOT new income!)
  if (normalizedType === 'GOAL_WITHDRAWAL') {
    const withdrAmt = Math.abs(numAmount)
    const txId = `tx_gw_${timestamp}_${Math.random().toString(36).slice(2, 6)}`
    const txTitle = title || `Withdrew from ${goalName || 'goal'}`
    const txDesc = description || `Withdrew ₹${withdrAmt.toLocaleString('en-IN')} from ${goalName || 'goal'}.`

    const transactionRecord = {
      id: txId,
      type: 'GOAL_WITHDRAWAL',
      title: txTitle,
      description: txDesc,
      category: 'Goals', // NOT 'Income'!
      amount: withdrAmt, // Inflow into available balance
      goalId: goalId ? String(goalId) : null,
      goalName: goalName || 'Goal',
      userId: String(userId || 'rookie@example.com'),
      date: txDate,
      timestamp,
      icon: icon || '↺',
      isGoalWithdrawal: true
    }

    await putInStore('transactions', transactionRecord)
    await notifySubscribers()
    return { transaction: transactionRecord }
  }

  // 3. PARENT APPROVAL LOCKED: Locked funds awaiting receipt confirmation
  if (normalizedType === 'PARENT_APPROVAL_LOCKED') {
    const lockedAmt = Math.abs(numAmount)
    const txId = `tx_pal_${timestamp}_${Math.random().toString(36).slice(2, 6)}`
    const transactionRecord = {
      id: txId,
      type: 'PARENT_APPROVAL_LOCKED',
      title: title || 'Parent Funds Locked',
      description: description || `₹${lockedAmt.toLocaleString('en-IN')} parent-approved funds locked.`,
      category: 'Parent Approval',
      amount: lockedAmt,
      requestId: requestId ? String(requestId) : null,
      pitchId: pitchId ? String(pitchId) : null,
      userId: String(userId || 'rookie@example.com'),
      date: txDate,
      timestamp,
      icon: icon || '🔒'
    }

    await putInStore('transactions', transactionRecord)
    await notifySubscribers()
    return { transaction: transactionRecord }
  }

  // 4. PARENT FUNDS UNLOCKED: Parent funds released into available cash
  if (normalizedType === 'PARENT_FUNDS_UNLOCKED') {
    const unlockedAmt = Math.abs(numAmount)
    const txId = `tx_pfu_${timestamp}_${Math.random().toString(36).slice(2, 6)}`
    const transactionRecord = {
      id: txId,
      type: 'PARENT_FUNDS_UNLOCKED',
      title: title || 'Parent Funds Unlocked',
      description: description || `₹${unlockedAmt.toLocaleString('en-IN')} parent funds unlocked.`,
      category: 'Parent Approval',
      amount: unlockedAmt,
      creditAvailable: Boolean(creditAvailable),
      requestId: requestId ? String(requestId) : null,
      pitchId: pitchId ? String(pitchId) : null,
      userId: String(userId || 'rookie@example.com'),
      date: txDate,
      timestamp,
      icon: icon || '🔓'
    }

    await putInStore('transactions', transactionRecord)
    await notifySubscribers()
    return { transaction: transactionRecord }
  }

  // 5. PARENT APPROVAL EXPIRED: Expired parent request lock removal
  if (normalizedType === 'PARENT_APPROVAL_EXPIRED') {
    const expiredAmt = Math.abs(numAmount)
    const txId = `tx_pae_${timestamp}_${Math.random().toString(36).slice(2, 6)}`
    const transactionRecord = {
      id: txId,
      type: 'PARENT_APPROVAL_EXPIRED',
      title: title || 'Parent Approval Expired',
      description: description || `₹${expiredAmt.toLocaleString('en-IN')} parent approval expired.`,
      category: 'Parent Approval',
      amount: expiredAmt,
      requestId: requestId ? String(requestId) : null,
      pitchId: pitchId ? String(pitchId) : null,
      userId: String(userId || 'rookie@example.com'),
      date: txDate,
      timestamp,
      icon: icon || '⏱️'
    }

    await putInStore('transactions', transactionRecord)
    await notifySubscribers()
    return { transaction: transactionRecord }
  }

  // Default to EXPENSE or MONEY_ADDED if type is not set or matches
  const txId = `tx_${timestamp}_${Math.random().toString(36).slice(2, 6)}`

  // 6. EXPENSE THAT EXCEEDS BALANCE (OVERSPENDING APPROVED)
  if (numAmount < 0 && isOverspend) {
    const expenseAmt = Math.abs(numAmount)
    const availableAtStart = currentState.availableBalance
    const shortfallAmt = Math.round((expenseAmt - availableAtStart) * 100) / 100
    const shortfallId = `sf_${timestamp}_${Math.random().toString(36).slice(2, 6)}`

    // Create the shortfall record
    const shortfallRecord = {
      id: shortfallId,
      type: 'overspend',
      title: `Overspend: ${title}`,
      originalAmount: shortfallAmt,
      settledAmount: 0,
      remainingAmount: shortfallAmt,
      status: 'outstanding',
      date: txDate,
      timestamp,
      relatedTransactionId: txId,
      lender: null, // "Never invent a person or creditor"
      settlements: []
    }

    await putInStore('shortfalls', shortfallRecord)

    // Create corresponding ledger entry
    const transactionRecord = {
      id: txId,
      type: 'EXPENSE',
      title,
      category,
      amount: -expenseAmt,
      date: txDate,
      timestamp,
      icon: icon || '↘',
      isOverspend: true,
      shortfallId,
      shortfallAmount: shortfallAmt,
      availableAtExecution: availableAtStart,
      userId: String(userId || 'rookie@example.com'),
      description: description || title
    }

    await putInStore('transactions', transactionRecord)
    await notifySubscribers()
    return { transaction: transactionRecord, shortfall: shortfallRecord }
  }

  // 7. NORMAL EXPENSE (WITHIN AVAILABLE BALANCE)
  if (numAmount < 0) {
    const expenseAmt = Math.abs(numAmount)
    const transactionRecord = {
      id: txId,
      type: 'EXPENSE',
      title,
      category,
      amount: -expenseAmt,
      date: txDate,
      timestamp,
      icon: icon || '↘',
      isOverspend: false,
      userId: String(userId || 'rookie@example.com'),
      description: description || title
    }

    await putInStore('transactions', transactionRecord)
    await notifySubscribers()
    return { transaction: transactionRecord }
  }

  // 8. MONEY_ADDED / INCOME / MONEY RECEIVED (APPLIES TO OUTSTANDING SHORTFALLS FIRST)
  if (numAmount > 0) {
    const incomeAmt = numAmount
    let remainingIncome = incomeAmt
    const settlementAllocations = []

    // Fetch active shortfalls sorted by oldest first (FIFO)
    const activeShortfalls = (currentState.shortfalls || [])
      .filter(sf => sf.status !== 'settled' && sf.remainingAmount > 0)
      .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))

    for (const sf of activeShortfalls) {
      if (remainingIncome <= 0) break

      const needed = Number(sf.remainingAmount)
      const allocated = Math.min(remainingIncome, needed)

      sf.settledAmount = Math.round((Number(sf.settledAmount) + allocated) * 100) / 100
      sf.remainingAmount = Math.round((Number(sf.originalAmount) - sf.settledAmount) * 100) / 100
      sf.status = sf.remainingAmount <= 0 ? 'settled' : 'partially_settled'

      const settlementEntry = {
        id: `stl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        amount: allocated,
        date: txDate,
        timestamp: Date.now(),
        sourceTxId: txId,
        paymentSource: 'incoming_money',
        note: `Auto-settled from: ${title}`
      }

      sf.settlements = sf.settlements || []
      sf.settlements.push(settlementEntry)

      await putInStore('shortfalls', sf)

      settlementAllocations.push({
        shortfallId: sf.id,
        shortfallTitle: sf.title,
        amount: allocated
      })

      remainingIncome = Math.round((remainingIncome - allocated) * 100) / 100
    }

    const transactionRecord = {
      id: txId,
      type: 'MONEY_ADDED',
      title,
      category,
      amount: incomeAmt,
      date: txDate,
      timestamp,
      icon: icon || '↗',
      settlementAllocations,
      appliedToShortfalls: incomeAmt - remainingIncome,
      creditedToAvailable: remainingIncome,
      userId: String(userId || 'rookie@example.com'),
      description: description || title
    }

    await putInStore('transactions', transactionRecord)
    await notifySubscribers()
    return { transaction: transactionRecord, settlementAllocations }
  }
}

/**
 * Dedicated helper to record a Goal Contribution
 */
export const recordGoalContribution = async ({
  goalId,
  goalName,
  amount,
  userId = 'rookie@example.com',
  date,
  title,
  description
}) => {
  const res = await recordTransaction({
    type: 'GOAL_CONTRIBUTION',
    goalId,
    goalName,
    amount,
    userId,
    date,
    title,
    description,
    icon: '🎯'
  })
  return res?.transaction || res
}

/**
 * Dedicated helper to record a Goal Withdrawal
 */
export const recordGoalWithdrawal = async ({
  goalId,
  goalName,
  amount,
  userId = 'rookie@example.com',
  date,
  title,
  description
}) => {
  const res = await recordTransaction({
    type: 'GOAL_WITHDRAWAL',
    goalId,
    goalName,
    amount,
    userId,
    date,
    title,
    description,
    icon: '↺'
  })
  return res?.transaction || res
}

/**
 * Dedicated helper to record Locked Parent Funds
 */
export const recordParentApprovalLocked = async ({
  requestId,
  pitchId,
  title,
  amount,
  userId = 'rookie@example.com',
  date,
  description
}) => {
  const res = await recordTransaction({
    type: 'PARENT_APPROVAL_LOCKED',
    requestId,
    pitchId,
    title,
    amount,
    userId,
    date,
    description,
    icon: '🔒'
  })
  return res?.transaction || res
}

/**
 * Dedicated helper to record Unlocked Parent Funds
 */
export const recordParentFundsUnlocked = async ({
  requestId,
  pitchId,
  title,
  amount,
  userId = 'rookie@example.com',
  date,
  description,
  creditAvailable = false
}) => {
  const res = await recordTransaction({
    type: 'PARENT_FUNDS_UNLOCKED',
    requestId,
    pitchId,
    title,
    amount,
    userId,
    date,
    description,
    creditAvailable,
    icon: '🔓'
  })
  return res?.transaction || res
}

/**
 * Dedicated helper to record Expired Parent Approval
 */
export const recordParentApprovalExpired = async ({
  requestId,
  pitchId,
  title,
  amount,
  userId = 'rookie@example.com',
  date,
  description
}) => {
  const res = await recordTransaction({
    type: 'PARENT_APPROVAL_EXPIRED',
    requestId,
    pitchId,
    title,
    amount,
    userId,
    date,
    description,
    icon: '⏱️'
  })
  return res?.transaction || res
}

/**
 * Manually settles a specific shortfall
 */
export const settleShortfallManually = async (shortfallId, settleAmount, paymentSource = 'external') => {
  const state = await getCentralAccountingState()
  const sf = state.shortfalls.find(x => x.id === shortfallId)
  if (!sf) throw new Error('Shortfall not found')

  const parsedAmt = Math.min(sf.remainingAmount, Math.max(0.01, Number(settleAmount) || 0))
  const roundedAmt = Math.round(parsedAmt * 100) / 100

  if (paymentSource === 'available_cash') {
    if (state.availableBalance < roundedAmt) {
      throw new Error(`Insufficient available cash (₹${state.availableBalance}) to settle ₹${roundedAmt}.`)
    }
  }

  sf.settledAmount = Math.round((Number(sf.settledAmount) + roundedAmt) * 100) / 100
  sf.remainingAmount = Math.round((Number(sf.originalAmount) - sf.settledAmount) * 100) / 100
  sf.status = sf.remainingAmount <= 0 ? 'settled' : 'partially_settled'

  const settlementId = `stl_man_${Date.now()}`
  const settlementEntry = {
    id: settlementId,
    amount: roundedAmt,
    date: new Date().toISOString().slice(0, 10),
    timestamp: Date.now(),
    paymentSource,
    note: paymentSource === 'available_cash' ? 'Manual settlement from LOOT cash' : 'Manual settlement via external cash'
  }

  sf.settlements = sf.settlements || []
  sf.settlements.push(settlementEntry)

  await putInStore('shortfalls', sf)

  // If settled from available cash, log an expense entry in ledger
  if (paymentSource === 'available_cash') {
    await putInStore('transactions', {
      id: `tx_stl_${Date.now()}`,
      title: `Settled Shortfall: ${sf.title}`,
      category: 'Settlement',
      amount: -roundedAmt,
      date: settlementEntry.date,
      timestamp: Date.now(),
      icon: '✓',
      isShortfallSettlement: true,
      shortfallId: sf.id
    })
  }

  await notifySubscribers()
  return sf
}

/**
 * Records genuine borrowed money (requires an explicit lender name)
 * "Distinguish between an overspending shortfall and actual borrowed money.
 * Actual borrowing must have an explicitly recorded lender, amount and repayment history.
 * Never invent a person or creditor."
 */
export const recordBorrowedLoan = async ({ lender, amount, purpose = 'Loan' }) => {
  if (!lender || !lender.trim()) {
    throw new Error('Lender name is required for genuine borrowed money.')
  }

  const numAmt = Math.max(1, Number(amount) || 0)
  const timestamp = Date.now()
  const loanId = `loan_${timestamp}_${Math.random().toString(36).slice(2, 6)}`
  const txDate = new Date().toISOString().slice(0, 10)

  const loanRecord = {
    id: loanId,
    type: 'loan',
    lender: lender.trim(),
    purpose: purpose.trim() || 'Borrowed money',
    originalAmount: numAmt,
    repaidAmount: 0,
    remainingAmount: numAmt,
    status: 'outstanding',
    date: txDate,
    timestamp,
    repayments: []
  }

  await putInStore('loans', loanRecord)

  // Also create a shortfall item so it tracks under debt obligations
  const sfRecord = {
    id: `sf_loan_${loanId}`,
    type: 'loan',
    title: `Loan from ${loanRecord.lender}: ${loanRecord.purpose}`,
    originalAmount: numAmt,
    settledAmount: 0,
    remainingAmount: numAmt,
    status: 'outstanding',
    date: txDate,
    timestamp,
    lender: loanRecord.lender,
    loanId,
    settlements: []
  }

  await putInStore('shortfalls', sfRecord)

  // Add cash inflow since loan money was received
  await putInStore('transactions', {
    id: `tx_borrow_${timestamp}`,
    title: `Borrowed from ${loanRecord.lender}`,
    category: 'Income',
    amount: numAmt,
    date: txDate,
    timestamp,
    icon: '🤝',
    isLoanInflow: true,
    loanId
  })

  await notifySubscribers()
  return loanRecord
}

/**
 * Resets storage for New User mode
 */
export const resetMoneyEngineForNewUser = async (initialBalance = 0) => {
  memoryStore = {
    settings: {
      openingBalance: initialBalance,
      onboardingCompleted: initialBalance > 0,
      openingBalanceDate: new Date().toISOString(),
      adjustments: []
    },
    transactions: [],
    shortfalls: [],
    loans: []
  }

  const db = await openMoneyDB()
  if (db) {
    const stores = ['settings', 'transactions', 'shortfalls', 'loans']
    for (const storeName of stores) {
      await new Promise((resolve) => {
        try {
          const tx = db.transaction(storeName, 'readwrite')
          tx.objectStore(storeName).clear()
          tx.oncomplete = () => resolve()
          tx.onerror = () => resolve()
        } catch {
          resolve()
        }
      })
    }

    if (initialBalance > 0) {
      await putInStore('settings', { key: 'openingBalance', value: initialBalance })
      await putInStore('settings', { key: 'onboardingCompleted', value: true })
    }
  }

  await notifySubscribers()
}

/**
 * Helper to test scenarios in Node test environment
 */
export const _resetMemoryStoreForTesting = () => {
  memoryStore = {
    settings: {
      openingBalance: 0,
      onboardingCompleted: false,
      openingBalanceDate: null,
      adjustments: []
    },
    transactions: [],
    shortfalls: [],
    loans: []
  }
}
