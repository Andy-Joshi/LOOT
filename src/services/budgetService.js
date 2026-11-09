/**
 * LOOT — Budget & Relatable Spending Service
 *
 * Implements:
 * 1. Mathematically accurate Relatable Spending unit conversions (e.g. Samosas @ ₹20, Boba Teas @ ₹100).
 * 2. Dynamic quantity calculations with sensible decimal/whole-number formatting.
 * 3. Weekly remaining budget calculations with strict qualification rules (excluding goal contributions,
 *    internal transfers, and locked parent funds).
 * 4. Overspending detection and budget week boundary resolution.
 */

export const DEFAULT_RELATABLE_UNITS = [
  { id: 'samosas', name: 'Samosas', singular: 'samosa', plural: 'samosas', icon: '🥟', defaultPrice: 20 },
  { id: 'boba', name: 'Boba Teas', singular: 'boba tea', plural: 'boba teas', icon: '🧋', defaultPrice: 100 },
  { id: 'pizzas', name: 'Pizza Slices', singular: 'pizza slice', plural: 'pizza slices', icon: '🍕', defaultPrice: 150 },
  { id: 'burgers', name: 'Burgers', singular: 'burger', plural: 'burgers', icon: '🍔', defaultPrice: 80 },
  { id: 'movies', name: 'Movie Tickets', singular: 'movie ticket', plural: 'movie tickets', icon: '🎬', defaultPrice: 250 }
]

/**
 * Format a relatable item quantity sensibly.
 * Returns whole numbers when possible, or at most 1-2 decimal places without misleading rounding.
 *
 * Examples:
 * 25 -> "25"
 * 5.0 -> "5"
 * 7.5 -> "7.5"
 * 2.3333 -> "2.3"
 * 0.35 -> "0.35"
 *
 * @param {number} qty
 * @returns {string}
 */
export function formatRelatableQuantity(qty) {
  if (isNaN(qty) || qty <= 0) return '0'
  if (Number.isInteger(qty)) return String(qty)

  const oneDec = Math.round(qty * 10) / 10
  if (Math.abs(qty - oneDec) < 0.001) {
    return String(oneDec)
  }

  if (qty < 1) {
    const twoDec = Math.round(qty * 100) / 100
    return String(twoDec)
  }

  return String(oneDec)
}

/**
 * Convert a monetary amount into relatable everyday units.
 *
 * @param {number} amount - Spending amount in Rupees
 * @param {Object} [customPrices={}] - Configured price overrides { [unitId]: number }
 * @returns {Array<Object>} List of converted relatable items
 */
export function calculateRelatableUnits(amount, customPrices = {}) {
  const safeAmount = Math.max(0, Number(amount) || 0)

  return DEFAULT_RELATABLE_UNITS.map(unit => {
    const unitPrice = Math.max(1, Number(customPrices[unit.id]) || unit.defaultPrice)
    const rawQuantity = safeAmount / unitPrice
    const formattedQuantity = formatRelatableQuantity(rawQuantity)
    const isSingle = Number(formattedQuantity) === 1
    const label = isSingle ? unit.singular : unit.plural

    return {
      id: unit.id,
      name: unit.name,
      singular: unit.singular,
      plural: unit.plural,
      icon: unit.icon,
      unitPrice,
      rawQuantity,
      formattedQuantity,
      label,
      displayText: `${formattedQuantity} ${label}`
    }
  })
}

/**
 * Convert an amount into a specific relatable unit.
 *
 * @param {number} amount
 * @param {string} unitId
 * @param {Object} [customPrices={}]
 * @returns {Object}
 */
export function convertToUnit(amount, unitId = 'samosas', customPrices = {}) {
  const all = calculateRelatableUnits(amount, customPrices)
  return all.find(u => u.id === unitId) || all[0]
}

/**
 * Determine whether a transaction is an eligible/qualifying spending expense.
 *
 * Strict qualification criteria:
 * - Must be an outflow (expense).
 * - Excludes goal contributions (e.g. GOAL_CONTRIBUTION, or transactions tagged with goalId).
 * - Excludes goal withdrawals (GOAL_WITHDRAWAL).
 * - Excludes money additions (MONEY_ADDED, INCOME).
 * - Excludes locked parent approval requests or transfers.
 * - Excludes loans or shortfall auto-settlements.
 * - Amount must be a valid, positive outflow.
 *
 * @param {Object} t - Transaction object
 * @returns {boolean}
 */
export function isQualifyingExpense(t) {
  if (!t) return false
  const type = String(t.type || '').toUpperCase()

  // Explicit non-expense types
  if (
    type === 'GOAL_CONTRIBUTION' ||
    type === 'GOAL_WITHDRAWAL' ||
    type === 'MONEY_ADDED' ||
    type === 'INCOME' ||
    type === 'TRANSFER' ||
    type === 'SHORTFALL_SETTLEMENT' ||
    type.startsWith('PARENT_')
  ) {
    return false
  }

  // Explicit goal markers
  if (t.isGoalWithdrawal) return false
  if (t.goalId && type !== 'EXPENSE') return false
  if (String(t.category || '').toLowerCase() === 'goals' && type !== 'EXPENSE') return false

  // Validate amount: must be non-zero and non-NaN
  const numAmt = Number(t.amount)
  if (isNaN(numAmt)) return false

  // If explicit type is EXPENSE:
  if (type === 'EXPENSE') {
    return Math.abs(numAmt) > 0
  }

  // Fallback: negative amount is an expense if not disqualified above
  return numAmt < 0
}

/**
 * Calculate the rolling 7-day budget week boundaries.
 * Respects the existing LOOT budget week window ending on referenceDate (or today).
 *
 * @param {Array<Object>} [transactions=[]]
 * @param {Date|string|number} [referenceDate=null]
 * @returns {{ weekStart: Date, weekEnd: Date, refDate: Date }}
 */
export function getBudgetWeekWindow(transactions = [], referenceDate = null) {
  const today = referenceDate ? new Date(referenceDate) : new Date()
  today.setHours(23, 59, 59, 999)
  let refDate = today

  // If demo dataset contains future transactions, extend reference date to latest transaction
  if (Array.isArray(transactions)) {
    for (const t of transactions) {
      if (t && t.date) {
        const d = new Date(`${t.date}T23:59:59`)
        if (!isNaN(d.getTime()) && d > refDate) {
          refDate = d
        }
      }
    }
  }

  const weekStart = new Date(refDate)
  weekStart.setDate(refDate.getDate() - 6)
  weekStart.setHours(0, 0, 0, 0)

  const weekEnd = new Date(refDate)
  weekEnd.setHours(23, 59, 59, 999)

  return { weekStart, weekEnd, refDate }
}

/**
 * Calculate weekly remaining budget statistics.
 *
 * Calculation:
 * Weekly remaining budget = Weekly budget - Eligible expenses recorded during the current budget week.
 *
 * Edge cases handled:
 * - No weekly budget configured: hasBudget = false.
 * - No expenses this week: remaining = weeklyBudget, spent = 0, progress = 0%.
 * - Spending equals budget: remaining = 0, progress = 100%, isOverBudget = false.
 * - Spending exceeds budget: remaining = 0 (never negative), isOverBudget = true, overspentAmount = spent - budget.
 * - Goal contributions and transfers: excluded from spent.
 *
 * @param {Object} params
 * @param {number|null} params.weeklyBudget - Configured weekly budget in Rupees
 * @param {Array<Object>} [params.transactions=[]] - List of transaction records
 * @param {Date|string|number} [params.referenceDate=null] - Optional reference date
 * @returns {Object}
 */
export function calculateWeeklyBudgetStats({ weeklyBudget, transactions = [], referenceDate = null }) {
  const numBudget = Number(weeklyBudget)
  const hasBudget = !isNaN(numBudget) && numBudget > 0
  const safeBudget = hasBudget ? numBudget : 0

  const { weekStart, weekEnd } = getBudgetWeekWindow(transactions, referenceDate)

  // Filter qualifying expenses within the budget week window
  const qualifyingTransactions = (transactions || []).filter(item => {
    if (!isQualifyingExpense(item)) return false
    if (!item.date) return false
    const d = new Date(`${item.date}T12:00:00`)
    if (isNaN(d.getTime())) return false
    return d >= weekStart && d <= weekEnd
  })

  // Compute spent amount
  const spent = qualifyingTransactions.reduce((sum, item) => {
    const val = Math.abs(Number(item.amount))
    return sum + (isNaN(val) ? 0 : val)
  }, 0)

  const remaining = hasBudget ? Math.max(0, safeBudget - spent) : 0
  const isOverBudget = hasBudget && spent > safeBudget
  const overspentAmount = isOverBudget ? spent - safeBudget : 0
  const progressPercent = hasBudget
    ? Math.min(999, Math.round((spent / safeBudget) * 100))
    : 0

  const now = referenceDate ? new Date(referenceDate) : new Date()
  const msDiff = weekEnd.getTime() - now.getTime()
  const daysRemaining = Math.max(1, Math.min(7, Math.ceil(msDiff / (1000 * 60 * 60 * 24))))

  return {
    hasBudget,
    weeklyBudget: safeBudget,
    spent,
    remaining,
    isOverBudget,
    overspentAmount,
    progressPercent,
    qualifyingTransactions,
    txCount: qualifyingTransactions.length,
    weekStart,
    weekEnd,
    daysRemaining
  }
}
