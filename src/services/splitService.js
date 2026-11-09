/**
 * LOOT — Split Bills 2.0 Domain Service
 *
 * Implements:
 * 1. Equal distribution with exact rounding handling (sum strictly equals total bill).
 * 2. Custom distribution validation and unallocated balance calculation.
 * 3. Settlement metrics calculation (settled amount, remaining, progress, bill status).
 */

/**
 * Distribute a total amount equally among a number of participants.
 * Handles indivisible amounts with penny-exact precision so that
 * the sum of all allocated amounts always equals the original total.
 *
 * Examples:
 * distributeEqually(150, 3) -> [50, 50, 50]
 * distributeEqually(100, 3) -> [33.34, 33.33, 33.33] (sum = 100.00)
 * distributeEqually(10, 3)  -> [3.34, 3.33, 3.33]   (sum = 10.00)
 * distributeEqually(7, 2)   -> [3.5, 3.5]            (sum = 7.00)
 *
 * @param {number} total - Total bill amount
 * @param {number} count - Number of participants
 * @returns {Array<number>} Array of allocated amounts
 */
export function distributeEqually(total, count) {
  const numTotal = Number(total)
  const numCount = Math.floor(Number(count))

  if (isNaN(numTotal) || numTotal <= 0 || isNaN(numCount) || numCount <= 0) {
    return []
  }

  const totalCents = Math.round(numTotal * 100)
  const baseCents = Math.floor(totalCents / numCount)
  const remainderCents = totalCents % numCount

  const shares = []
  for (let i = 0; i < numCount; i++) {
    const extraCent = i < remainderCents ? 1 : 0
    const cents = baseCents + extraCent
    shares.push(Number((cents / 100).toFixed(2)))
  }

  return shares
}

/**
 * Validate a custom split allocation against the bill total.
 *
 * Rules:
 * - Total bill must be > 0.
 * - Must have at least 1 participant.
 * - Participant names must not be empty.
 * - Participant amounts must be non-negative numbers.
 * - Sum of allocated amounts must equal the total bill.
 *
 * @param {number} total - Total bill amount
 * @param {Array<{ name: string, amount: number|string }>} participants
 * @returns {{ valid: boolean, error?: string, allocatedTotal: number, unallocated: number }}
 */
export function validateCustomSplit(total, participants = []) {
  const numTotal = Number(total)
  if (isNaN(numTotal) || numTotal <= 0) {
    return {
      valid: false,
      error: 'Please enter a valid bill total greater than ₹0.',
      allocatedTotal: 0,
      unallocated: 0
    }
  }

  if (!Array.isArray(participants) || participants.length === 0) {
    return {
      valid: false,
      error: 'Please add at least one participant to split the bill.',
      allocatedTotal: 0,
      unallocated: numTotal
    }
  }

  let allocatedTotal = 0
  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]
    const name = String(p?.name || '').trim()
    if (!name) {
      return {
        valid: false,
        error: `Participant #${i + 1} needs a name.`,
        allocatedTotal,
        unallocated: Number((numTotal - allocatedTotal).toFixed(2))
      }
    }

    const amt = Number(p.amount)
    if (isNaN(amt) || amt < 0) {
      return {
        valid: false,
        error: `Invalid amount for ${name}. Amount cannot be negative.`,
        allocatedTotal,
        unallocated: Number((numTotal - allocatedTotal).toFixed(2))
      }
    }

    allocatedTotal += amt
  }

  allocatedTotal = Number(allocatedTotal.toFixed(2))
  const unallocated = Number((numTotal - allocatedTotal).toFixed(2))

  if (Math.abs(unallocated) > 0.01) {
    if (unallocated > 0) {
      return {
        valid: false,
        error: `Allocated ₹${allocatedTotal.toLocaleString('en-IN')} of ₹${numTotal.toLocaleString('en-IN')}. ₹${unallocated.toLocaleString('en-IN')} remaining to allocate.`,
        allocatedTotal,
        unallocated
      }
    } else {
      const overAmount = Math.abs(unallocated)
      return {
        valid: false,
        error: `Total allocated exceeds bill by ₹${overAmount.toLocaleString('en-IN')}. Please reduce participant amounts.`,
        allocatedTotal,
        unallocated
      }
    }
  }

  return {
    valid: true,
    allocatedTotal,
    unallocated: 0
  }
}

/**
 * Calculate settlement progress and metrics for a split bill.
 *
 * Statuses:
 * - 'Pending' / 'pending': No participants paid yet.
 * - 'Partially Settled' / 'partial': At least one participant paid, but not all.
 * - 'Fully Settled' / 'settled': All participants marked as paid.
 *
 * @param {Object} split
 * @returns {Object} Settlement metrics
 */
export function calculateSplitProgress(split) {
  if (!split) {
    return {
      settledAmount: 0,
      remainingAmount: 0,
      paidCount: 0,
      totalCount: 0,
      progressPercent: 0,
      status: 'Pending',
      statusKey: 'pending',
      isFullySettled: false
    }
  }

  const total = Number(split.total) || 0
  const participants = Array.isArray(split.participants) ? split.participants : []
  const totalCount = participants.length

  const settledAmount = participants
    .filter(p => Boolean(p.paid))
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0)

  const safeSettled = Number(settledAmount.toFixed(2))
  const remainingAmount = Math.max(0, Number((total - safeSettled).toFixed(2)))
  const paidCount = participants.filter(p => Boolean(p.paid)).length

  const isFullySettled = totalCount > 0 && paidCount === totalCount
  const isPartiallySettled = paidCount > 0 && paidCount < totalCount

  let status = 'Pending'
  let statusKey = 'pending'

  if (isFullySettled) {
    status = 'Fully Settled'
    statusKey = 'settled'
  } else if (isPartiallySettled) {
    status = 'Partially Settled'
    statusKey = 'partial'
  }

  const progressPercent = total > 0
    ? Math.min(100, Math.round((safeSettled / total) * 100))
    : 0

  return {
    settledAmount: safeSettled,
    remainingAmount,
    paidCount,
    totalCount,
    progressPercent,
    status,
    statusKey,
    isFullySettled
  }
}
