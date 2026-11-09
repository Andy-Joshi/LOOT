/**
 * LOOT Central Goal ETA & Spending Impact Calculation Engine
 *
 * Implements:
 * 1. Historical savings pace calculation (4–8 week window, net of withdrawals).
 * 2. Goal ETA and completion date projection based on actual financial pace.
 * 3. Goal status determination: On Track, Behind Pace, Almost There, Completed.
 * 4. Q2 Spending Impact calculation: computes goal delays resulting from expenses.
 * 5. Strict financial domain rules: excludes locked parent funds, expired approvals,
 *    and unreceived money; avoids division by zero; ensures zero-pace goals do not invent ETAs.
 */

export const HISTORICAL_WINDOW_DAYS = 56 // 8 weeks standard window
export const MIN_PACE_WINDOW_DAYS = 7    // Minimum 1 week denominator to avoid day-1 spike distortion

/**
 * Formats a Date object or timestamp into user-friendly standard format
 */
export function formatEtaDate(date) {
  if (!date) return 'No ETA'
  const d = new Date(date)
  if (isNaN(d.getTime())) return 'No ETA'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

/**
 * Calculates historical savings pace for a goal from qualifying transactions
 *
 * @param {Object} goal - Goal record with target, saved, contributions array
 * @param {Array} [allTransactions=[]] - General financial ledger transactions
 * @param {Array} [parentRequests=[]] - Parent requests for locked/expired verification
 * @param {Object} [options={}] - Override options (now, windowDays)
 * @returns {{ weeklyPace: number, dailyPace: number, netSavings: number, hasSufficientHistory: boolean }}
 */
export function calculateSavingsPace(goal, allTransactions = [], parentRequests = [], options = {}) {
  if (!goal) {
    return { weeklyPace: 0, dailyPace: 0, netSavings: 0, hasSufficientHistory: false }
  }

  const now = options.now ? new Date(options.now).getTime() : Date.now()
  const windowDays = options.windowDays || HISTORICAL_WINDOW_DAYS
  const windowStart = now - windowDays * 86400000

  // 1. Gather all explicit contributions and withdrawals recorded on the goal
  const goalHistory = Array.isArray(goal.contributions) ? goal.contributions : []

  // Filter qualifying contributions within historical window
  const qualifyingEntries = goalHistory.filter(entry => {
    const entryTime = entry.timestamp || (entry.date ? new Date(entry.date).getTime() : 0)
    return entryTime >= windowStart && entryTime <= now
  })

  // 2. Filter out locked parent-approved funds and expired parent approvals
  // Locked parent requests are earmarked for a pitch and cannot be counted as general savings
  const lockedOrExpiredRequestIds = new Set(
    (parentRequests || [])
      .filter(pr => {
        const isExpired = pr.expires_at && new Date(pr.expires_at).getTime() < now
        const isLockedPitch = pr.status === 'approved' // locked specifically for that pitch
        return isExpired || isLockedPitch
      })
      .map(pr => String(pr.id || pr.pitch_id))
  )

  let totalContributed = 0
  let totalWithdrawn = 0
  let earliestTime = now

  qualifyingEntries.forEach(entry => {
    // Exclude any entry linked to locked or expired parent funds
    if (entry.parentRequestId && lockedOrExpiredRequestIds.has(String(entry.parentRequestId))) {
      return
    }

    const amt = Math.abs(Number(entry.amount) || 0)
    const entryTime = entry.timestamp || (entry.date ? new Date(entry.date).getTime() : now)
    if (entryTime < earliestTime) {
      earliestTime = entryTime
    }

    if (entry.type === 'withdrawal' || Number(entry.amount) < 0) {
      totalWithdrawn += amt
    } else {
      totalContributed += amt
    }
  })

  const netSavings = Math.max(0, totalContributed - totalWithdrawn)

  // 1. If the goal has an explicitly defined savings allocation pace (e.g. ₹500/week):
  if (Number(goal.weeklySavingsPace) > 0) {
    const pace = Math.max(0, Number(goal.weeklySavingsPace))
    return {
      weeklyPace: pace,
      dailyPace: pace / 7,
      netSavings: qualifyingEntries.length > 0 ? netSavings : (Number(goal.saved) || 0),
      hasSufficientHistory: true
    }
  }

  // 2. If there are no qualifying contributions recorded in history and no explicit allocation:
  if (qualifyingEntries.length === 0 || totalContributed <= 0) {
    return {
      weeklyPace: 0,
      dailyPace: 0,
      netSavings: 0,
      hasSufficientHistory: false
    }
  }

  // Calculate effective elapsed duration in the historical window
  const elapsedDays = Math.max(MIN_PACE_WINDOW_DAYS, (now - earliestTime) / 86400000)
  const elapsedWeeks = Math.max(1, elapsedDays / 7)

  // Average weekly pace over the window
  const weeklyPace = Math.max(0, Math.round((netSavings / elapsedWeeks) * 100) / 100)
  const dailyPace = weeklyPace > 0 ? weeklyPace / 7 : 0

  return {
    weeklyPace,
    dailyPace,
    netSavings,
    hasSufficientHistory: weeklyPace > 0
  }
}

/**
 * Calculates Goal ETA, time remaining, completion date, and status indicators
 *
 * @param {Object} goal - Goal record
 * @param {number|Object} [paceInput] - Weekly savings pace or result of calculateSavingsPace
 * @param {Object} [options={}] - Options (now)
 * @returns {Object} Complete Goal ETA analytics
 */
export function calculateGoalEta(goal, paceInput = null, options = {}) {
  if (!goal) {
    return {
      target: 0,
      saved: 0,
      remaining: 0,
      progressPercent: 0,
      isCompleted: false,
      weeklyPace: 0,
      dailyPace: 0,
      etaWeeks: null,
      etaDays: null,
      estimatedDate: null,
      formattedEta: 'Start saving to unlock your ETA',
      formattedDate: 'No ETA',
      status: 'Needs Pace',
      statusKey: 'no_pace'
    }
  }

  const now = options.now ? new Date(options.now) : new Date()
  const target = Math.max(0, Number(goal.target) || 0)
  const saved = Math.max(0, Number(goal.saved) || 0)
  const remaining = Math.max(0, target - saved)
  const progressPercent = target > 0 ? Math.min(100, Math.round((saved / target) * 1000) / 10) : 0
  const isCompleted = target > 0 ? (saved >= target || Boolean(goal.completed)) : false

  // 1. Goal is Completed
  if (isCompleted) {
    return {
      target,
      saved: Math.max(target, saved),
      remaining: 0,
      progressPercent: 100,
      isCompleted: true,
      weeklyPace: 0,
      dailyPace: 0,
      etaWeeks: 0,
      etaDays: 0,
      estimatedDate: null,
      formattedEta: 'Goal Completed',
      formattedDate: 'Achieved',
      status: 'Completed',
      statusKey: 'completed'
    }
  }

  // 2. Resolve Weekly Pace
  let weeklyPace = 0
  if (typeof paceInput === 'number') {
    weeklyPace = Math.max(0, paceInput)
  } else if (paceInput && typeof paceInput.weeklyPace === 'number') {
    weeklyPace = Math.max(0, paceInput.weeklyPace)
  } else if (Number(goal.weeklySavingsPace) > 0) {
    weeklyPace = Number(goal.weeklySavingsPace)
  }

  // 3. Goal has Zero Savings Pace or Insufficient History
  if (weeklyPace <= 0) {
    return {
      target,
      saved,
      remaining,
      progressPercent,
      isCompleted: false,
      weeklyPace: 0,
      dailyPace: 0,
      etaWeeks: null,
      etaDays: null,
      estimatedDate: null,
      formattedEta: 'Start saving to unlock your ETA',
      formattedDate: 'Start saving to unlock ETA',
      status: 'Needs Pace',
      statusKey: 'no_pace'
    }
  }

  // 4. Calculate ETA with Positive Pace
  const dailyPace = weeklyPace / 7
  const etaDays = Math.max(1, Math.ceil(remaining / dailyPace))
  const etaWeeks = Math.max(0.1, Math.round((remaining / weeklyPace) * 10) / 10)
  const estimatedDate = new Date(now.getTime() + etaDays * 86400000)

  // 5. Determine Goal Status Indicator
  let status = 'On Track'
  let statusKey = 'on_track'

  if (progressPercent >= 85) {
    status = 'Almost There'
    statusKey = 'almost_there'
  } else if (goal.deadline) {
    const deadlineDate = new Date(goal.deadline)
    if (!isNaN(deadlineDate.getTime())) {
      // Behind pace if estimated completion is after the target deadline
      if (estimatedDate.getTime() > deadlineDate.getTime()) {
        status = 'Behind Pace'
        statusKey = 'behind_pace'
      } else {
        status = 'On Track'
        statusKey = 'on_track'
      }
    }
  }

  const formattedEta = etaWeeks === 1 ? '1 week' : `${etaWeeks} weeks`
  const formattedDate = formatEtaDate(estimatedDate)

  return {
    target,
    saved,
    remaining,
    progressPercent,
    isCompleted: false,
    weeklyPace,
    dailyPace,
    etaWeeks,
    etaDays,
    estimatedDate: estimatedDate.toISOString(),
    formattedEta,
    formattedDate,
    status,
    statusKey
  }
}

/**
 * Calculates Spending Impact (Q2) of an expense across active goals
 *
 * @param {Object} expense - Recorded expense object { amount, title, category }
 * @param {Array} goals - Array of active savings goals
 * @param {Object} [options={}] - Contextual options (accountingState, now)
 * @returns {Object} Complete Spending Impact analysis
 */
export function calculateSpendingImpact(expense, goals = [], options = {}) {
  const expenseAmount = Math.abs(Number(expense?.amount) || 0)

  // 1. Validate expense amount
  if (expenseAmount <= 0) {
    return {
      hasImpact: false,
      reason: 'zero_amount',
      neutralMessage: 'Transaction has no spending amount — savings goals unaffected.'
    }
  }

  // 2. Filter active (non-completed) goals
  const activeGoals = (goals || []).filter(g => {
    const target = Number(g.target) || 0
    const saved = Number(g.saved) || 0
    return !g.completed && target > saved
  })

  if (activeGoals.length === 0) {
    return {
      hasImpact: false,
      reason: 'no_active_goals',
      neutralMessage: 'Expense logged smoothly — you have no active savings goals affected.'
    }
  }

  // 3. Compute baseline ETA for each active goal and filter those with valid pace
  const evaluatedGoals = activeGoals.map(goal => {
    const paceInfo = calculateSavingsPace(goal, [], [], options)
    const etaInfo = calculateGoalEta(goal, paceInfo, options)
    return {
      goal,
      paceInfo,
      etaInfo
    }
  })

  // Only goals with a positive savings pace can have an ETA delay calculated
  const eligibleGoals = evaluatedGoals.filter(item => item.etaInfo.weeklyPace > 0)

  if (eligibleGoals.length === 0) {
    return {
      hasImpact: false,
      reason: 'insufficient_pace',
      neutralMessage: 'Expense recorded — your goals do not have an active savings pace yet. Start saving to unlock ETA impact.'
    }
  }

  // 4. Identify and Rank Affected Goals
  // Sort candidate goals: category match first (most relevant), then closest deadline, then progress
  const expenseCategory = (expense.category || '').trim().toLowerCase()
  const candidateGoals = [...eligibleGoals].sort((a, b) => {
    const aCatMatch = expenseCategory && (a.goal.category || '').toLowerCase() === expenseCategory ? 1 : 0
    const bCatMatch = expenseCategory && (b.goal.category || '').toLowerCase() === expenseCategory ? 1 : 0
    if (aCatMatch !== bCatMatch) return bCatMatch - aCatMatch

    const aDeadline = a.goal.deadline ? new Date(a.goal.deadline).getTime() : Infinity
    const bDeadline = b.goal.deadline ? new Date(b.goal.deadline).getTime() : Infinity
    if (aDeadline !== bDeadline) return aDeadline - bDeadline

    return b.etaInfo.progressPercent - a.etaInfo.progressPercent
  })

  // 5. Calculate Delay for each affected goal
  const impacts = candidateGoals.map(item => {
    const { goal, etaInfo } = item
    const weeklyPace = etaInfo.weeklyPace
    const dailyPace = etaInfo.dailyPace

    // Delay calculation as defined in specification:
    // Estimated time remaining = Remaining amount / Weekly savings pace
    // Goal delay in days = Math.round(expenseAmount / dailyPace)
    const delayDays = Math.max(1, Math.round(expenseAmount / dailyPace))
    const delayWeeks = Math.max(0.1, Math.round((delayDays / 7) * 10) / 10)

    // Compute updated completion dates
    const beforeEtaDate = new Date(etaInfo.estimatedDate)
    const afterEtaDate = new Date(beforeEtaDate.getTime() + delayDays * 86400000)

    const beforeDays = etaInfo.etaDays
    const afterDays = beforeDays + delayDays

    return {
      goalId: goal.id,
      goalName: goal.name,
      goalCategory: goal.category,
      goalColor: goal.color || 'lime',
      goalIcon: goal.icon || '◎',
      target: goal.target,
      saved: goal.saved,
      remaining: etaInfo.remaining,
      weeklyPace,
      dailyPace,
      delayDays,
      delayWeeks,
      beforeDays,
      afterDays,
      beforeEtaDate: formatEtaDate(beforeEtaDate),
      afterEtaDate: formatEtaDate(afterEtaDate),
      beforeDateIso: beforeEtaDate.toISOString(),
      afterDateIso: afterEtaDate.toISOString(),
      badgeText: `+${delayDays} DAYS`,
      headline: 'Your purchase has an impact!',
      message: `That purchase pushes your ${goal.name} goal back by ${delayDays} ${delayDays === 1 ? 'day' : 'days'}.`
    }
  })

  const primaryImpact = impacts[0]
  const otherAffected = impacts.slice(1)

  return {
    hasImpact: true,
    expenseAmount,
    expenseTitle: expense.title || 'Expense',
    expenseCategory: expense.category || 'Lifestyle',
    primaryImpact,
    otherAffected,
    totalAffectedCount: impacts.length
  }
}
