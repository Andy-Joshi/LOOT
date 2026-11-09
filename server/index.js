import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import {
  COIN_REWARDS,
  STORE_ITEMS,
  calculateRankAndLevel,
  safeAtomicWriteDb,
  initializeCoinEngine,
  hasTransactionWithReference,
  earnCoins,
  spendCoins,
  reverseTransaction,
  getWalletStats
} from './coinEngine.js'
import { getSupabaseHealth } from './supabaseClient.js'
import {
  createParentRequest,
  getParentRequestByToken,
  submitParentResponse,
  revokeParentRequest,
  sanitizeParentRequest
} from './parentRequestsService.js'
import {
  calculateSavingsPace,
  calculateGoalEta,
  calculateSpendingImpact
} from '../src/services/goalEtaService.js'
import {
  distributeEqually,
  validateCustomSplit
} from '../src/services/splitService.js'

export function enrichGoal(goal, db) {
  const pace = calculateSavingsPace(goal, db?.transactions || [], db?.parentRequests || [])
  const eta = calculateGoalEta(goal, pace)
  return {
    ...goal,
    completed: Boolean(goal.completed || eta.isCompleted),
    contributions: goal.contributions || [],
    remaining: eta.remaining,
    progressPercent: eta.progressPercent,
    weeklySavingsPace: eta.weeklyPace,
    dailySavingsPace: eta.dailyPace,
    etaWeeks: eta.etaWeeks,
    etaDays: eta.etaDays,
    estimatedCompletionDate: eta.estimatedDate,
    formattedEta: eta.formattedEta,
    formattedDate: eta.formattedDate,
    status: eta.status,
    statusKey: eta.statusKey
  }
}

/**
 * Authoritative Server Wallet Balance Calculation
 *
 * Separates user funds into:
 * - Available Balance: Money available for spending.
 * - Goal Savings: Money allocated to active savings goals (sum of goal.saved).
 * - Locked Funds: Parent-approved funds awaiting receipt confirmation (cannot be spent or withdrawn).
 * - Total Owned Money: Available Balance + Goal Savings (excludes locked parent funds).
 */
export function calculateWalletBalances(db) {
  const transactions = db?.transactions || []
  const chronologicalTxs = [...transactions].sort((a, b) => {
    const timeA = a.timestamp || (a.date ? new Date(a.date).getTime() : 0) || Number(a.id) || 0
    const timeB = b.timestamp || (b.date ? new Date(b.date).getTime() : 0) || Number(b.id) || 0
    return timeA - timeB
  })

  let available = Number(db?.profile?.openingBalance) || 0
  let ledgerGoalSavings = 0
  let ledgerLockedFunds = 0

  for (const tx of chronologicalTxs) {
    if (tx.isAdjustment) continue
    const amt = Number(tx.amount) || 0
    const rawType = tx.type ? String(tx.type).toUpperCase() : null
    let type = rawType
    if (!type) {
      if (amt < 0) type = 'EXPENSE'
      else if (amt > 0) type = 'MONEY_ADDED'
    }

    if (type === 'GOAL_CONTRIBUTION') {
      const contribAmt = Math.abs(amt)
      available = Math.max(0, available - contribAmt)
      ledgerGoalSavings += contribAmt
    } else if (type === 'GOAL_WITHDRAWAL') {
      const withdrAmt = Math.abs(amt)
      available += withdrAmt
      ledgerGoalSavings = Math.max(0, ledgerGoalSavings - withdrAmt)
    } else if (type === 'PARENT_APPROVAL_LOCKED') {
      ledgerLockedFunds += Math.abs(amt)
    } else if (type === 'PARENT_FUNDS_UNLOCKED') {
      ledgerLockedFunds = Math.max(0, ledgerLockedFunds - Math.abs(amt))
      if (tx.creditAvailable) available += Math.abs(amt)
    } else if (type === 'PARENT_APPROVAL_EXPIRED') {
      ledgerLockedFunds = Math.max(0, ledgerLockedFunds - Math.abs(amt))
    } else if (type === 'EXPENSE' || amt < 0) {
      available = Math.max(0, available - Math.abs(amt))
    } else if (type === 'MONEY_ADDED' || amt > 0) {
      available += amt
    }
  }

  // Active goal savings sum
  const activeGoals = db?.goals || []
  const goalSavings = activeGoals.reduce((sum, g) => sum + Math.max(0, Number(g.saved) || 0), 0)

  // Locked funds from approved, non-expired parent requests
  const now = Date.now()
  const parentRequests = db?.parentRequests || []
  const lockedFunds = parentRequests
    .filter(pr => {
      const isApproved = pr.status === 'approved'
      const isExpired = pr.expires_at && new Date(pr.expires_at).getTime() < now
      return isApproved && !isExpired
    })
    .reduce((sum, pr) => sum + (Number(pr.requested_amount) || 0), 0)

  const availableBalance = Math.max(0, Math.round(available * 100) / 100)
  const finalGoalSavings = Math.max(0, Math.round((Array.isArray(db?.goals) ? goalSavings : ledgerGoalSavings) * 100) / 100)
  const finalLockedFunds = Math.max(0, Math.round((Array.isArray(db?.parentRequests) ? lockedFunds : ledgerLockedFunds) * 100) / 100)
  const totalOwnedMoney = Math.max(0, Math.round((availableBalance + finalGoalSavings) * 100) / 100)

  return {
    availableBalance,
    goalSavings: finalGoalSavings,
    lockedFunds: finalLockedFunds,
    totalOwnedMoney,
    totalMoney: totalOwnedMoney
  }
}

const root = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH || join(root, 'db.json')
const port = Number(process.env.PORT || 3001)

const readDb = () => JSON.parse(readFileSync(dbPath, 'utf8'))
const writeDb = (db) => safeAtomicWriteDb(dbPath, db)

const send = (res, status, payload) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS'
  })
  res.end(JSON.stringify(payload))
}

const body = async (req) => {
  let raw = ''
  for await (const chunk of req) raw += chunk
  return raw ? JSON.parse(raw) : {}
}

const id = (value) => String(value || '').split('/').filter(Boolean).pop()

const summary = (db) => ({
  profile: db.profile,
  goals: (db.goals || []).map(g => enrichGoal(g, db)),
  transactions: db.transactions,
  splits: db.splits,
  pools: db.pools,
  challenges: db.challenges,
  achievements: db.achievements,
  pitches: db.pitches,
  parentRequests: (db.parentRequests || []).map(r => sanitizeParentRequest(r)),
  notifications: db.notifications,
  coinTransactions: db.coinTransactions || [],
  coinStats: getWalletStats(db),
  storeItems: STORE_ITEMS,
  coinRewards: COIN_REWARDS,
  walletBreakdown: calculateWalletBalances(db)
})

// Ensure database file exists and initialize engine
if (!existsSync(dbPath)) {
  writeDb({
    profile: { id: 1, name: 'Rookie Saver', email: 'rookie@example.com', rank: 'Saving Rookie', coins: 0, streak: 0, avatar: 'R', accent: 'lime', bio: 'Building financial discipline from scratch.', unlockedPerks: [], experienceMode: 'new_user' },
    goals: [],
    transactions: [],
    splits: [],
    pools: [],
    challenges: [],
    achievements: [],
    pitches: [],
    notifications: [],
    coinTransactions: []
  })
}

// Perform engine initialization and migration on startup
try {
  const initialDb = readDb()
  initializeCoinEngine(initialDb, dbPath)
} catch (err) {
  console.error('Initialization error:', err)
}

createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {})
  const url = new URL(req.url, `http://${req.headers.host}`)
  const path = url.pathname

  try {
    const db = readDb()
    initializeCoinEngine(db, null)

    // Health & Full App State
    if (req.method === 'GET' && path === '/api/health') {
      return send(res, 200, { ok: true, service: 'loot-api', engine: 'centralized-loot-coin-v2' })
    }

    if (req.method === 'GET' && path === '/api/state') {
      return send(res, 200, summary(db))
    }

    if (req.method === 'GET' && (path === '/api/wallet/breakdown' || path === '/api/wallet/state')) {
      return send(res, 200, calculateWalletBalances(db))
    }

    // Global Search
    if (req.method === 'GET' && path === '/api/search') {
      const query = (url.searchParams.get('q') || '').toLowerCase()
      const results = [
        ...db.goals,
        ...db.transactions,
        ...db.challenges,
        ...db.pitches,
        ...db.pools,
        ...(db.coinTransactions || [])
      ].filter(item => JSON.stringify(item).toLowerCase().includes(query))
      return send(res, 200, results)
    }

    // ==========================================
    // COIN ENGINE SPECIFIC ENDPOINTS
    // ==========================================

    // Get Coin Transactions Ledger with filtering & pagination
    if (req.method === 'GET' && path === '/api/coins/transactions') {
      const category = url.searchParams.get('category')
      const type = url.searchParams.get('type')
      const query = (url.searchParams.get('q') || '').toLowerCase()
      const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') || 50)))
      const offset = Math.max(0, Number(url.searchParams.get('offset') || 0))

      let filtered = [...(db.coinTransactions || [])]

      if (type && type !== 'all') {
        filtered = filtered.filter(tx => tx.type === type)
      }

      if (category && category !== 'all') {
        filtered = filtered.filter(tx => {
          const cat = (tx.category || '').toLowerCase()
          return cat === category.toLowerCase()
        })
      }

      if (query) {
        filtered = filtered.filter(tx =>
          (tx.title || '').toLowerCase().includes(query) ||
          (tx.description || '').toLowerCase().includes(query) ||
          (tx.source || '').toLowerCase().includes(query) ||
          (tx.referenceId || '').toLowerCase().includes(query)
        )
      }

      const total = filtered.length
      const paginated = filtered.slice(offset, offset + limit)

      return send(res, 200, {
        total,
        limit,
        offset,
        transactions: paginated,
        stats: getWalletStats(db)
      })
    }

    // Get Coin & Wallet Metrics
    if (req.method === 'GET' && path === '/api/coins/stats') {
      return send(res, 200, getWalletStats(db))
    }

    // Get Rewards Store Catalog
    if (req.method === 'GET' && path === '/api/coins/store') {
      return send(res, 200, {
        items: STORE_ITEMS,
        unlockedPerks: db.profile.unlockedPerks || [],
        balance: db.profile.coins
      })
    }

    // Spend Coins on a Store Item / Perk
    if (req.method === 'POST' && path === '/api/coins/spend') {
      const input = await body(req)
      const { itemId, idempotencyKey } = input

      const item = STORE_ITEMS.find(i => i.id === itemId)
      if (!item) {
        return send(res, 404, { error: `Store item "${itemId}" not found` })
      }

      // Check single-purchase perk ownership
      if (item.category !== 'boost' && Array.isArray(db.profile.unlockedPerks) && db.profile.unlockedPerks.includes(item.id)) {
        return send(res, 400, { error: `You have already unlocked "${item.name}"!` })
      }

      const tx = spendCoins(db, {
        amount: item.price,
        category: 'rewards',
        title: `Redeemed: ${item.name}`,
        description: item.description,
        source: 'reward_store',
        referenceId: `store_${item.id}_${Date.now()}`,
        idempotencyKey
      })

      if (!Array.isArray(db.profile.unlockedPerks)) {
        db.profile.unlockedPerks = []
      }
      if (!db.profile.unlockedPerks.includes(item.id)) {
        db.profile.unlockedPerks.push(item.id)
      }

      db.notifications.unshift({
        id: Date.now(),
        text: `Unlocked ${item.name} for ${item.price} LOOT Coins!`,
        icon: item.icon || '🎁',
        read: false
      })

      await writeDb(db)
      return send(res, 200, {
        success: true,
        transaction: tx,
        item,
        profile: db.profile,
        stats: getWalletStats(db)
      })
    }

    // Reverse a Coin Transaction (Safety / Reversal)
    if (req.method === 'POST' && path === '/api/coins/reverse') {
      const input = await body(req)
      const { transactionId, reason } = input
      if (!transactionId) {
        return send(res, 400, { error: 'transactionId is required' })
      }

      const reversalTx = reverseTransaction(db, transactionId, reason)
      await writeDb(db)
      return send(res, 200, {
        success: true,
        transaction: reversalTx,
        profile: db.profile,
        stats: getWalletStats(db)
      })
    }

    // ==========================================
    // PROFILE MANAGEMENT & EXPERIENCE MODES
    // ==========================================
    if (req.method === 'PATCH' && path === '/api/profile') {
      const updates = await body(req)
      if (updates.experienceMode === 'new_user' || updates.resetCoins) {
        db.profile.coins = 0
        db.profile.streak = 0
        db.profile.rank = 'Saving Rookie'
        db.coinTransactions = []
        db.goals = []
        db.transactions = []
        db.splits = []
        db.pools = []
        db.pitches = []
        if (Array.isArray(db.challenges)) {
          db.challenges.forEach(c => { c.progress = 0; c.joined = false; c.status = 'available' })
        }
        if (Array.isArray(db.achievements)) {
          db.achievements.forEach(a => { a.unlocked = false })
        }
      } else {
        delete updates.coins
      }
      if (updates.openingBalance !== undefined) {
        db.profile.openingBalance = Math.max(0, Number(updates.openingBalance) || 0)
      }
      db.profile = { ...db.profile, ...updates }
      const rankInfo = calculateRankAndLevel(db.profile.coins)
      db.profile.rank = rankInfo.rank

      await writeDb(db)
      return send(res, 200, db.profile)
    }

    // ==========================================
    // WEEKLY BUDGET CADENCE
    // ==========================================
    if (req.method === 'GET' && path === '/api/budget') {
      return send(res, 200, {
        weeklyBudget: Number(db.profile?.weeklyBudget) > 0 ? Number(db.profile.weeklyBudget) : null
      })
    }

    if (req.method === 'PATCH' && path === '/api/budget') {
      const input = await body(req)
      const val = Number(input.weeklyBudget)
      if (isNaN(val) || val <= 0) {
        db.profile.weeklyBudget = null
      } else {
        db.profile.weeklyBudget = Math.round(val)
      }
      await writeDb(db)
      return send(res, 200, {
        ok: true,
        weeklyBudget: db.profile.weeklyBudget
      })
    }

    if (req.method === 'POST' && path === '/api/profile/experience-mode') {
      const input = await body(req)
      const mode = input.mode || 'test_user'
      const isNewUser = mode === 'new_user'

      if (isNewUser) {
        db.profile = {
          id: 1,
          name: 'Rookie Saver',
          email: 'rookie@example.com',
          rank: 'Saving Rookie',
          coins: 0,
          streak: 0,
          avatar: 'R',
          accent: 'lime',
          bio: 'Building financial discipline from scratch.',
          unlockedPerks: [],
          experienceMode: 'new_user'
        }
        db.goals = []
        db.transactions = []
        db.coinTransactions = []
        db.splits = []
        db.pools = []
        db.pitches = []
        db.challenges = [
          { id: 1, title: 'No-Spend Weekend', description: 'Zero discretionary spends for 48 hours.', reward: 30, target: 2, progress: 0, icon: '🛡️', category: 'discipline', joined: false, status: 'available' },
          { id: 2, title: 'Daily Drip', description: 'Save at least ₹50 per day for 3 consecutive days.', reward: 25, target: 3, progress: 0, icon: '💧', category: 'habit', joined: false, status: 'available' },
          { id: 3, title: 'Track Attack', description: 'Log 5 transactions to keep your spending radar razor sharp.', reward: 40, target: 5, progress: 0, icon: '⚡', category: 'tracking', joined: false, status: 'available' }
        ]
        db.achievements = [
          { id: 1, title: 'First Drop', description: 'Save money for the first time.', reward: 50, icon: '💧', unlocked: false },
          { id: 2, title: 'Level Up', description: 'Reach Level 2.', reward: 100, icon: '⚡', unlocked: false },
          { id: 3, title: 'Daily Drip', description: 'Save for three consecutive days.', reward: 150, icon: '🔥', unlocked: false },
          { id: 4, title: 'Tracker', description: 'Complete a savings goal.', reward: 300, icon: '◎', unlocked: false },
          { id: 5, title: 'Smart Shopper', description: 'Compare 3 prices with Smart Buy.', reward: 15, icon: '🛍️', unlocked: false }
        ]
        db.notifications = [
          { id: Date.now(), text: 'Welcome to LOOT! Set your first goal or lodge a spend to earn coins.', icon: '✦', time: 'Just now', read: false }
        ]
      } else {
        db.profile = {
          id: 1,
          name: 'Andy Joshi',
          email: 'andy@example.com',
          rank: 'Money Scout',
          coins: 620,
          streak: 4,
          avatar: 'A',
          accent: 'lime',
          bio: 'Saving for something big.',
          unlockedPerks: [],
          weeklyBudget: 2000,
          experienceMode: 'test_user'
        }
        const nowMs = Date.now()
        const oneWeek = 7 * 86400000
        const dStr = (ms) => new Date(ms).toISOString().slice(0, 10)

        db.goals = [
          {
            id: 1,
            name: 'Gaming Setup',
            category: 'Lifestyle',
            saved: 1240,
            target: 2000,
            deadline: '2027-01-15',
            color: 'lime',
            icon: '◈',
            completed: false,
            weeklySavingsPace: 310,
            contributions: [
              { id: 'gc-demo-1a', amount: 310, type: 'contribution', date: dStr(nowMs - 4 * oneWeek), timestamp: nowMs - 4 * oneWeek },
              { id: 'gc-demo-1b', amount: 310, type: 'contribution', date: dStr(nowMs - 3 * oneWeek), timestamp: nowMs - 3 * oneWeek },
              { id: 'gc-demo-1c', amount: 310, type: 'contribution', date: dStr(nowMs - 2 * oneWeek), timestamp: nowMs - 2 * oneWeek },
              { id: 'gc-demo-1d', amount: 310, type: 'contribution', date: dStr(nowMs - 1 * oneWeek), timestamp: nowMs - 1 * oneWeek }
            ]
          },
          {
            id: 2,
            name: 'Emergency Fund',
            category: 'Essentials',
            saved: 860,
            target: 1500,
            deadline: '2027-03-01',
            color: 'cyan',
            icon: '✦',
            completed: false,
            weeklySavingsPace: 215,
            contributions: [
              { id: 'gc-demo-2a', amount: 215, type: 'contribution', date: dStr(nowMs - 4 * oneWeek), timestamp: nowMs - 4 * oneWeek },
              { id: 'gc-demo-2b', amount: 215, type: 'contribution', date: dStr(nowMs - 3 * oneWeek), timestamp: nowMs - 3 * oneWeek },
              { id: 'gc-demo-2c', amount: 215, type: 'contribution', date: dStr(nowMs - 2 * oneWeek), timestamp: nowMs - 2 * oneWeek },
              { id: 'gc-demo-2d', amount: 215, type: 'contribution', date: dStr(nowMs - 1 * oneWeek), timestamp: nowMs - 1 * oneWeek }
            ]
          },
          {
            id: 3,
            name: 'Weekend Trip',
            category: 'Experiences',
            saved: 420,
            target: 800,
            deadline: '2026-12-20',
            color: 'purple',
            icon: '✈',
            completed: false,
            weeklySavingsPace: 105,
            contributions: [
              { id: 'gc-demo-3a', amount: 105, type: 'contribution', date: dStr(nowMs - 4 * oneWeek), timestamp: nowMs - 4 * oneWeek },
              { id: 'gc-demo-3b', amount: 105, type: 'contribution', date: dStr(nowMs - 3 * oneWeek), timestamp: nowMs - 3 * oneWeek },
              { id: 'gc-demo-3c', amount: 105, type: 'contribution', date: dStr(nowMs - 2 * oneWeek), timestamp: nowMs - 2 * oneWeek },
              { id: 'gc-demo-3d', amount: 105, type: 'contribution', date: dStr(nowMs - 1 * oneWeek), timestamp: nowMs - 1 * oneWeek }
            ]
          }
        ]
        db.transactions = [
          { id: 1, title: 'Coffee & snack', category: 'Lifestyle', amount: -180, date: '2026-11-06', icon: '☕' },
          { id: 2, title: 'Pocket money', category: 'Income', amount: 2500, date: '2026-11-05', icon: '↗' },
          { id: 3, title: 'Metro ride', category: 'Essentials', amount: -90, date: '2026-11-05', icon: '◇' },
          { id: 4, title: 'Movie night', category: 'Impulse', amount: -420, date: '2026-11-03', icon: '▣' }
        ]
        db.splits = []
        db.pools = [
          {
            id: 'pool-demo',
            name: 'Goa Trip Crew',
            purpose: 'Shared weekend trip fund',
            target: 24000,
            deadline: '2026-12-20',
            owner: 'Andy Joshi',
            members: [
              { name: 'Andy Joshi', target: 6000, contributed: 3200 },
              { name: 'Maya Shah', target: 6000, contributed: 6000 },
              { name: 'Arjun Mehta', target: 6000, contributed: 4500 },
              { name: 'Zoya Khan', target: 6000, contributed: 2000 }
            ]
          }
        ]
        db.challenges = [
          { id: 1, title: 'No-Spend Weekend', description: 'Zero discretionary spends for 48 hours.', reward: 30, target: 2, progress: 1, icon: '🛡️', category: 'discipline', joined: true, status: 'in_progress' },
          { id: 2, title: 'Daily Drip', description: 'Save at least ₹50 per day for 3 consecutive days.', reward: 25, target: 3, progress: 3, icon: '💧', category: 'habit', joined: true, status: 'completed' },
          { id: 3, title: 'Track Attack', description: 'Log 5 transactions to keep your spending radar razor sharp.', reward: 40, target: 5, progress: 3, icon: '⚡', category: 'tracking', joined: true, status: 'in_progress' }
        ]
        db.achievements = [
          { id: 1, title: 'First Drop', description: 'Save money for the first time.', reward: 50, icon: '💧', unlocked: true },
          { id: 2, title: 'Level Up', description: 'Reach Level 2.', reward: 100, icon: '⚡', unlocked: true },
          { id: 3, title: 'Daily Drip', description: 'Save for three consecutive days.', reward: 150, icon: '🔥', unlocked: true },
          { id: 4, title: 'Tracker', description: 'Complete a savings goal.', reward: 300, icon: '◎', unlocked: false },
          { id: 5, title: 'Smart Shopper', description: 'Compare 3 prices with Smart Buy.', reward: 15, icon: '🛍️', unlocked: false }
        ]
        db.pitches = []
        db.notifications = [
          { id: 1, text: 'You unlocked Level 2: Money Scout! Keep up the momentum.', icon: '⚡', time: '1h ago', read: false },
          { id: 2, text: 'Earned +2 LOOT Coins for logging Coffee & snack.', icon: '✦', time: '2h ago', read: false },
          { id: 3, text: 'Maya Shah contributed ₹1,500 to Goa Trip Crew pool.', icon: '👥', time: '5h ago', read: true }
        ]
        db.coinTransactions = [
          { id: 'tx-spend-1', type: 'spend', amount: 100, balanceAfter: 620, category: 'rewards', title: 'Redeemed: Parent Pitch Priority Pass', description: 'Fast-tracked parent pitch approval voucher', source: 'store_purchase', referenceId: 'purchase_perk-parent-voucher', timestamp: '2026-11-06T12:00:00.000Z' },
          { id: 'tx-earn-1', type: 'earn', amount: 25, balanceAfter: 720, category: 'challenges', title: 'Challenge Complete: Daily Drip', description: 'Earned 25 LOOT Coins for completing Daily Drip', source: 'challenge_completion', referenceId: 'challenge_comp_2', timestamp: '2026-11-06T09:30:00.000Z' },
          { id: 'tx-earn-2', type: 'earn', amount: 2, balanceAfter: 695, category: 'activities', title: 'Expense Logged: Coffee & snack', description: 'Tracked spend of ₹180', source: 'transaction_log', referenceId: 'tx_log_1', timestamp: '2026-11-06T08:15:00.000Z' },
          { id: 'tx-earn-3', type: 'earn', amount: 5, balanceAfter: 693, category: 'activities', title: 'Income Logged: Pocket money', description: 'Recorded income of ₹2,500', source: 'transaction_log', referenceId: 'tx_log_2', timestamp: '2026-11-05T14:00:00.000Z' }
        ]
      }

      initializeCoinEngine(db, null)
      await writeDb(db)
      return send(res, 200, summary(db))
    }

    // ==========================================
    // GOALS (SAVINGS MISSIONS)
    // ==========================================
    if (req.method === 'POST' && path === '/api/goals') {
      const input = await body(req)
      if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
        return send(res, 400, { error: 'Goal name is required.' })
      }
      const numTarget = Number(input.target)
      if (isNaN(numTarget) || numTarget <= 0 || !Number.isFinite(numTarget)) {
        return send(res, 400, { error: 'Goal target must be a valid amount greater than 0.' })
      }

      const goal = {
        id: input.id || Date.now(),
        name: input.name.trim(),
        category: input.category || 'Lifestyle',
        saved: 0,
        target: numTarget,
        deadline: input.deadline || null,
        color: input.color || 'lime',
        icon: input.icon || '◎',
        completed: false,
        contributions: [],
        weeklySavingsPace: Number(input.weeklySavingsPace) || 0
      }
      const enriched = enrichGoal(goal, db)
      Object.assign(goal, enriched)
      db.goals.push(goal)

      // Award coins via Centralized Engine
      earnCoins(db, {
        amount: COIN_REWARDS.GOAL_CREATE,
        category: 'goals',
        title: `New Goal: ${goal.name}`,
        description: `Created savings goal with target ₹${goal.target.toLocaleString('en-IN')}`,
        source: 'goal_creation',
        referenceId: `goal_create_${goal.id}`
      })

      await writeDb(db)
      return send(res, 201, goal)
    }

    if (req.method === 'POST' && path.match(/^\/api\/goals\/([^/]+)\/withdraw$/)) {
      const goalId = path.match(/^\/api\/goals\/([^/]+)\/withdraw$/)[1]
      const goal = db.goals.find(item => String(item.id) === goalId)
      if (!goal) return send(res, 404, { error: 'Goal not found' })
      const input = await body(req)
      const requestedAmt = Number(input.amount || input.withdrawal || 0)
      if (isNaN(requestedAmt) || requestedAmt <= 0 || !Number.isFinite(requestedAmt)) {
        return send(res, 400, { error: 'Withdrawal amount must be greater than 0.' })
      }
      if (goal.saved < requestedAmt) {
        return send(res, 400, { error: `Cannot withdraw ₹${requestedAmt}; current goal savings are ₹${goal.saved}.` })
      }

      goal.saved = Math.max(0, goal.saved - requestedAmt)
      if (goal.saved < goal.target) {
        goal.completed = false
      }
      if (!Array.isArray(goal.contributions)) goal.contributions = []
      const timestamp = Number(input.timestamp) || Date.now()
      goal.contributions.push({
        id: `withdr_${timestamp}_${Math.random().toString(36).slice(2, 6)}`,
        amount: requestedAmt,
        type: 'withdrawal',
        date: new Date().toISOString().slice(0, 10),
        timestamp
      })

      // Persistent transaction in db.transactions
      const withdrTx = {
        id: input.txId || Date.now(),
        type: 'GOAL_WITHDRAWAL',
        title: `Withdrew from ${goal.name}`,
        description: `Withdrew ₹${requestedAmt.toLocaleString('en-IN')} from ${goal.name} goal.`,
        category: 'Goals', // NOT 'Income'!
        amount: requestedAmt,
        goalId: String(goal.id),
        goalName: goal.name,
        userId: String(db.profile?.id || 'rookie@example.com'),
        date: new Date().toISOString().slice(0, 10),
        timestamp,
        icon: '↺',
        isGoalWithdrawal: true
      }
      if (!Array.isArray(db.transactions)) db.transactions = []
      db.transactions.unshift(withdrTx)

      const enriched = enrichGoal(goal, db)
      Object.assign(goal, enriched)
      await writeDb(db)
      return send(res, 200, { ...goal, transaction: withdrTx, walletBreakdown: calculateWalletBalances(db) })
    }

    if (req.method === 'POST' && path === '/api/goals/spending-impact') {
      const input = await body(req)
      const expense = input.expense || input
      const impact = calculateSpendingImpact(expense, db.goals, { parentRequests: db.parentRequests })
      return send(res, 200, impact)
    }

    if (req.method === 'PATCH' && path.startsWith('/api/goals/')) {
      const goal = db.goals.find(item => String(item.id) === id(path))
      if (!goal) return send(res, 404, { error: 'Goal not found' })
      const input = await body(req)

      if (!Array.isArray(goal.contributions)) {
        goal.contributions = []
      }

      if (input.contribution !== undefined) {
        const amount = Number(input.contribution)
        if (isNaN(amount) || amount <= 0 || !Number.isFinite(amount)) {
          return send(res, 400, { error: 'Contribution amount must be greater than 0.' })
        }

        goal.saved = Math.min(goal.target, goal.saved + amount)
        const timestamp = Number(input.timestamp) || Date.now()
        goal.contributions.push({
          id: `contrib_${timestamp}_${Math.random().toString(36).slice(2, 6)}`,
          amount,
          type: 'contribution',
          date: new Date().toISOString().slice(0, 10),
          timestamp
        })

        // Persistent transaction record in db.transactions
        const contribTx = {
          id: input.txId || Date.now(),
          type: 'GOAL_CONTRIBUTION',
          title: `Added ₹${amount.toLocaleString('en-IN')} to ${goal.name}`,
          description: `Added ₹${amount.toLocaleString('en-IN')} to ${goal.name} goal.`,
          category: 'Goals',
          amount: -amount,
          goalId: String(goal.id),
          goalName: goal.name,
          userId: String(db.profile?.id || 'rookie@example.com'),
          date: new Date().toISOString().slice(0, 10),
          timestamp,
          icon: '🎯'
        }
        if (!Array.isArray(db.transactions)) db.transactions = []
        db.transactions.unshift(contribTx)

        // Award coins proportional to saved amount
        const coinsEarned = Math.max(1, Math.round(amount / COIN_REWARDS.GOAL_CONTRIBUTION_DIVISOR))
        earnCoins(db, {
          amount: coinsEarned,
          category: 'goals',
          title: `Goal Contribution: ${goal.name}`,
          description: `Saved ₹${amount.toLocaleString('en-IN')} towards ${goal.name}`,
          source: 'goal_contribution',
          referenceId: `goal_contrib_${goal.id}_${Date.now()}`
        })

        // Check if goal was newly completed
        if (goal.saved >= goal.target && !goal.completed) {
          goal.completed = true

          // Bonus coins for achieving 100% target
          earnCoins(db, {
            amount: COIN_REWARDS.GOAL_COMPLETE_BONUS,
            category: 'goals',
            title: `Goal Complete: ${goal.name}`,
            description: `Reached 100% target for ${goal.name}!`,
            source: 'goal_completion',
            referenceId: `goal_complete_${goal.id}`
          })

          // Achievement: Tracker
          const tracker = Array.isArray(db.achievements) ? db.achievements.find(item => item.title === 'Tracker') : null
          if (tracker && !tracker.unlocked) {
            tracker.unlocked = true
            earnCoins(db, {
              amount: tracker.reward,
              category: 'achievements',
              title: `Achievement: ${tracker.title}`,
              description: tracker.description,
              source: 'achievement_unlock',
              referenceId: `achievement_${tracker.id}_unlock`
            })
          }

          if (!Array.isArray(db.notifications)) db.notifications = []
          db.notifications.unshift({
            id: Date.now(),
            text: `${goal.name} completed! Earned +${COIN_REWARDS.GOAL_COMPLETE_BONUS} bonus coins & Tracker unlocked.`,
            icon: '🏆',
            read: false
          })
        }
      } else if (input.withdrawal !== undefined) {
        const amount = Number(input.withdrawal)
        if (isNaN(amount) || amount <= 0 || !Number.isFinite(amount)) {
          return send(res, 400, { error: 'Withdrawal amount must be greater than 0.' })
        }
        if (goal.saved < amount) {
          return send(res, 400, { error: `Cannot withdraw ₹${amount}; current goal savings are ₹${goal.saved}.` })
        }

        goal.saved = Math.max(0, goal.saved - amount)
        if (goal.saved < goal.target) {
          goal.completed = false
        }
        const timestamp = Number(input.timestamp) || Date.now()
        goal.contributions.push({
          id: `withdr_${timestamp}_${Math.random().toString(36).slice(2, 6)}`,
          amount,
          type: 'withdrawal',
          date: new Date().toISOString().slice(0, 10),
          timestamp
        })

        // Persistent transaction record in db.transactions
        const withdrTx = {
          id: input.txId || Date.now(),
          type: 'GOAL_WITHDRAWAL',
          title: `Withdrew from ${goal.name}`,
          description: `Withdrew ₹${amount.toLocaleString('en-IN')} from ${goal.name} goal.`,
          category: 'Goals',
          amount: amount,
          goalId: String(goal.id),
          goalName: goal.name,
          userId: String(db.profile?.id || 'rookie@example.com'),
          date: new Date().toISOString().slice(0, 10),
          timestamp,
          icon: '↺',
          isGoalWithdrawal: true
        }
        if (!Array.isArray(db.transactions)) db.transactions = []
        db.transactions.unshift(withdrTx)
      } else {
        // Edit goal fields with validation
        if (input.target !== undefined) {
          const numTarget = Number(input.target)
          if (isNaN(numTarget) || numTarget <= 0 || !Number.isFinite(numTarget)) {
            return send(res, 400, { error: 'Goal target must be a valid amount greater than 0.' })
          }
          goal.target = numTarget
        }
        if (input.name !== undefined) {
          if (typeof input.name !== 'string' || !input.name.trim()) {
            return send(res, 400, { error: 'Goal name cannot be empty.' })
          }
          goal.name = input.name.trim()
        }
        if (input.category !== undefined) goal.category = input.category
        if (input.deadline !== undefined) goal.deadline = input.deadline || null
        if (input.weeklySavingsPace !== undefined) {
          goal.weeklySavingsPace = Math.max(0, Number(input.weeklySavingsPace) || 0)
        }
        if (input.color !== undefined) goal.color = input.color
        if (input.icon !== undefined) goal.icon = input.icon
      }

      const enriched = enrichGoal(goal, db)
      Object.assign(goal, enriched)
      await writeDb(db)
      return send(res, 200, goal)
    }

    if (req.method === 'DELETE' && path.startsWith('/api/goals/')) {
      const goalId = id(path)
      const targetGoal = db.goals.find(item => String(item.id) === goalId)
      if (targetGoal && targetGoal.saved > 0) {
        // Conserve funds: return goal savings back to available balance upon goal deletion
        const refundAmt = targetGoal.saved
        if (!Array.isArray(db.transactions)) db.transactions = []
        db.transactions.unshift({
          id: Date.now(),
          type: 'GOAL_WITHDRAWAL',
          title: `Goal Closed: ${targetGoal.name}`,
          description: `₹${refundAmt.toLocaleString('en-IN')} returned to available balance upon deleting goal.`,
          category: 'Goals',
          amount: refundAmt,
          goalId: String(targetGoal.id),
          goalName: targetGoal.name,
          userId: String(db.profile?.id || 'rookie@example.com'),
          date: new Date().toISOString().slice(0, 10),
          timestamp: Date.now(),
          icon: '↺',
          isGoalWithdrawal: true
        })
      }
      db.goals = db.goals.filter(item => String(item.id) !== goalId)
      await writeDb(db)
      return send(res, 200, { ok: true, id: goalId })
    }

    // ==========================================
    // CASH TRANSACTIONS (FIAT SPEND / INCOME)
    // ==========================================
    if (req.method === 'POST' && path === '/api/transactions') {
      const input = await body(req)
      if (!input.title || typeof input.title !== 'string' || !input.title.trim()) {
        return send(res, 400, { error: 'Transaction title is required.' })
      }
      const numAmount = Number(input.amount)
      if (isNaN(numAmount) || numAmount === 0 || !Number.isFinite(numAmount)) {
        return send(res, 400, { error: 'Transaction amount must be a non-zero valid number.' })
      }

      const isExpense = numAmount < 0
      const defaultType = isExpense ? 'EXPENSE' : 'MONEY_ADDED'
      const txType = input.type ? String(input.type).toUpperCase() : defaultType
      const txTimestamp = Number(input.timestamp) || Date.now()
      const txId = input.id || Date.now()

      const transaction = {
        id: txId,
        type: txType,
        title: input.title.trim(),
        category: input.category || (isExpense ? 'Lifestyle' : 'Income'),
        amount: numAmount,
        date: input.date || new Date().toISOString().slice(0, 10),
        icon: input.icon || (isExpense ? '•' : '↗'),
        ...(input.goalId ? { goalId: String(input.goalId) } : {}),
        ...(input.goalName ? { goalName: input.goalName } : {}),
        ...(input.description ? { description: input.description } : {}),
        userId: String(input.userId || db.profile?.id || 'rookie@example.com'),
        timestamp: txTimestamp
      }
      if (!Array.isArray(db.transactions)) db.transactions = []
      db.transactions.unshift(transaction)

      const spendingImpact = isExpense ? calculateSpendingImpact(transaction, db.goals, { parentRequests: db.parentRequests }) : null
      transaction.spendingImpact = spendingImpact

      const coinsEarned = isExpense ? COIN_REWARDS.TRANSACTION_EXPENSE : COIN_REWARDS.TRANSACTION_INCOME
      earnCoins(db, {
        amount: coinsEarned,
        category: 'activities',
        title: isExpense ? `Expense Logged: ${transaction.title}` : `Income Logged: ${transaction.title}`,
        description: `${isExpense ? 'Tracked spend of' : 'Recorded income of'} ₹${Math.abs(Number(transaction.amount)).toLocaleString('en-IN')}`,
        source: 'transaction_log',
        referenceId: `tx_log_${transaction.id}`
      })

      const tracker = db.challenges.find(item => item.title === 'Track Attack' && item.joined && item.status !== 'completed')
      if (tracker) {
        tracker.progress = Math.min(tracker.target, tracker.progress + 1)
      }

      await writeDb(db)
      return send(res, 201, transaction)
    }

    if (req.method === 'DELETE' && path.startsWith('/api/transactions/')) {
      db.transactions = db.transactions.filter(item => String(item.id) !== id(path))
      await writeDb(db)
      return send(res, 200, { ok: true })
    }

    // ==========================================
    // BILL SPLITS 2.0 (EQUAL, CUSTOM & SETTLEMENT REWARDS)
    // ==========================================
    if (req.method === 'POST' && path === '/api/splits') {
      const input = await body(req)
      const numTotal = Number(input.total)
      if (isNaN(numTotal) || numTotal <= 0) {
        return send(res, 400, { error: 'Valid total amount required' })
      }

      const mode = input.mode === 'custom' ? 'custom' : 'equal'
      let participants = []

      if (mode === 'equal') {
        const rawParticipants = Array.isArray(input.participants) ? input.participants : []
        const count = rawParticipants.length
        if (count === 0) {
          return send(res, 400, { error: 'At least one participant required' })
        }
        const shares = distributeEqually(numTotal, count)
        participants = rawParticipants.map((p, idx) => {
          const name = typeof p === 'string' ? p.trim() : String(p?.name || '').trim()
          return {
            id: typeof p === 'object' && p?.id ? p.id : `p_${Date.now()}_${idx}`,
            name: name || `Participant ${idx + 1}`,
            amount: shares[idx],
            paid: typeof p === 'object' ? Boolean(p?.paid) : false,
            paidAt: null
          }
        })
      } else {
        // Custom Mode
        const rawParticipants = Array.isArray(input.participants) ? input.participants : []
        const validation = validateCustomSplit(numTotal, rawParticipants)
        if (!validation.valid) {
          return send(res, 400, { error: validation.error })
        }
        participants = rawParticipants.map((p, idx) => ({
          id: p.id || `p_${Date.now()}_${idx}`,
          name: String(p.name || '').trim(),
          amount: Number(p.amount),
          paid: Boolean(p.paid),
          paidAt: null
        }))
      }

      const split = {
        id: Date.now(),
        title: (input.title || 'Split Bill').trim(),
        total: numTotal,
        mode,
        participants,
        status: 'pending',
        createdAt: new Date().toISOString(),
        settledAt: null,
        rewardClaimed: false
      }

      if (!Array.isArray(db.splits)) db.splits = []
      db.splits.unshift(split)

      // Note: Coins are awarded on full settlement, not upon creation
      await writeDb(db)
      return send(res, 201, split)
    }

    if (req.method === 'POST' && path.match(/\/api\/splits\/[^/]+\/settle$/)) {
      const splitId = path.split('/')[3]
      const split = (db.splits || []).find(item => String(item.id) === splitId)
      if (!split) return send(res, 404, { error: 'Split not found' })

      split.participants.forEach(p => {
        p.paid = true
        if (!p.paidAt) p.paidAt = new Date().toISOString()
      })
      split.status = 'settled'
      if (!split.settledAt) split.settledAt = new Date().toISOString()

      let coinsAwarded = 0
      let isNewlySettled = false
      if (!split.rewardClaimed) {
        const refId = `split_settled_${split.id}`
        try {
          earnCoins(db, {
            amount: COIN_REWARDS.BILL_SETTLEMENT || 25,
            category: 'activities',
            title: `Bill Settled: ${split.title}`,
            description: `Settled split bill "${split.title}" (₹${split.total.toLocaleString('en-IN')})`,
            source: 'split_settlement',
            referenceId: refId
          })
          split.rewardClaimed = true
          coinsAwarded = COIN_REWARDS.BILL_SETTLEMENT || 25
          isNewlySettled = true
        } catch {
          split.rewardClaimed = true
          coinsAwarded = 0
          isNewlySettled = false
        }
      }

      await writeDb(db)
      return send(res, 200, { ...split, coinsAwarded, isNewlySettled })
    }

    if (req.method === 'PATCH' && path.startsWith('/api/splits/')) {
      const split = (db.splits || []).find(item => String(item.id) === id(path))
      if (!split) return send(res, 404, { error: 'Split not found' })

      const input = await body(req)

      let targetIdx = -1
      if (Number.isInteger(input.participant)) {
        targetIdx = input.participant
      } else if (input.participantId) {
        targetIdx = split.participants.findIndex(p => String(p.id) === String(input.participantId))
      }

      if (targetIdx >= 0 && targetIdx < split.participants.length) {
        const isPaid = input.paid !== undefined ? Boolean(input.paid) : true
        split.participants[targetIdx].paid = isPaid
        split.participants[targetIdx].paidAt = isPaid ? new Date().toISOString() : null
      }

      // Recalculate settlement status
      const totalCount = split.participants.length
      const paidCount = split.participants.filter(p => Boolean(p.paid)).length
      const allPaid = totalCount > 0 && paidCount === totalCount
      const anyPaid = paidCount > 0

      if (allPaid) {
        split.status = 'settled'
        if (!split.settledAt) {
          split.settledAt = new Date().toISOString()
        }
      } else if (anyPaid) {
        split.status = 'partial'
        split.settledAt = null
      } else {
        split.status = 'pending'
        split.settledAt = null
      }

      // Settlement Reward validation (idempotent, awarded exactly once)
      let coinsAwarded = 0
      let isNewlySettled = false

      if (allPaid && !split.rewardClaimed) {
        const refId = `split_settled_${split.id}`
        try {
          earnCoins(db, {
            amount: COIN_REWARDS.BILL_SETTLEMENT || 25,
            category: 'activities',
            title: `Bill Settled: ${split.title}`,
            description: `Settled split bill "${split.title}" (₹${split.total.toLocaleString('en-IN')})`,
            source: 'split_settlement',
            referenceId: refId
          })
          split.rewardClaimed = true
          coinsAwarded = COIN_REWARDS.BILL_SETTLEMENT || 25
          isNewlySettled = true
        } catch {
          split.rewardClaimed = true
          coinsAwarded = 0
          isNewlySettled = false
        }
      }

      await writeDb(db)
      return send(res, 200, {
        ...split,
        coinsAwarded,
        isNewlySettled
      })
    }

    if (req.method === 'DELETE' && path.startsWith('/api/splits/')) {
      const splitId = id(path)
      db.splits = (db.splits || []).filter(item => String(item.id) !== splitId)
      await writeDb(db)
      return send(res, 200, { ok: true, id: splitId })
    }

    // ==========================================
    // CREW SAVINGS POOLS
    // ==========================================
    if (req.method === 'POST' && path === '/api/pools') {
      const input = await body(req)
      if (!input.name || typeof input.name !== 'string' || !input.name.trim()) {
        return send(res, 400, { error: 'Pool name is required.' })
      }
      const members = (input.members || []).map(member => typeof member === 'string'
        ? { name: member, target: 0, contributed: 0 }
        : { name: member.name, target: Number(member.target || 0), contributed: 0 })
      const rawTarget = Number(input.target || members.reduce((sum, member) => sum + member.target, 0))
      if (isNaN(rawTarget) || rawTarget <= 0 || !Number.isFinite(rawTarget)) {
        return send(res, 400, { error: 'Pool target must be a valid amount greater than 0.' })
      }

      const pool = {
        id: randomUUID(),
        name: input.name.trim(),
        purpose: input.purpose || 'Shared savings',
        target: rawTarget,
        deadline: input.deadline || null,
        owner: db.profile.name,
        members: [{ name: db.profile.name, target: Number(input.ownerTarget || 0), contributed: 0 }, ...members],
        createdAt: new Date().toISOString(),
        status: 'active'
      }
      db.pools.unshift(pool)

      earnCoins(db, {
        amount: COIN_REWARDS.POOL_CREATE,
        category: 'activities',
        title: `Crew Pool: ${pool.name}`,
        description: `Created collective savings pool for ${pool.purpose}`,
        source: 'pool_creation',
        referenceId: `pool_create_${pool.id}`
      })

      await writeDb(db)
      return send(res, 201, pool)
    }

    if (req.method === 'PATCH' && path.startsWith('/api/pools/')) {
      const pool = db.pools.find(item => String(item.id) === id(path))
      if (!pool) return send(res, 404, { error: 'Pool not found' })
      const input = await body(req)
      const member = pool.members.find(item => item.name.toLowerCase() === String(input.member || db.profile.name).toLowerCase())
      if (!member) return send(res, 404, { error: 'Pool member not found' })

      const amount = Number(input.contribution || 0)
      if (isNaN(amount) || amount <= 0 || !Number.isFinite(amount)) {
        return send(res, 400, { error: 'Contribution amount must be greater than 0.' })
      }

      member.contributed += amount
      if (pool.members.every(item => item.target > 0 && item.contributed >= item.target)) pool.status = 'complete'

      const poolCoins = Math.floor(amount / COIN_REWARDS.POOL_CONTRIBUTION_DIVISOR)
      if (poolCoins > 0) {
        earnCoins(db, {
          amount: poolCoins,
          category: 'activities',
          title: `Crew Deposit: ${pool.name}`,
          description: `Added ₹${amount.toLocaleString('en-IN')} to ${pool.name}`,
          source: 'pool_contribution',
          referenceId: `pool_contrib_${pool.id}_${Date.now()}`
        })
      }

      db.notifications.unshift({
        id: Date.now(),
        text: `${member.name} added ₹${amount.toLocaleString('en-IN')} to ${pool.name}.`,
        icon: '👥',
        read: false
      })

      await writeDb(db)
      return send(res, 200, pool)
    }

    // ==========================================
    // CHALLENGES
    // ==========================================
    if (req.method === 'POST' && path.startsWith('/api/challenges/') && path.endsWith('/join')) {
      const challengeId = id(path.replace(/\/join$/, ''))
      const challenge = db.challenges.find(item => String(item.id) === challengeId)
      if (!challenge) return send(res, 404, { error: 'Challenge not found' })

      if (challenge.joined) {
        return send(res, 400, { error: 'Challenge already joined' })
      }

      challenge.joined = true
      challenge.status = 'active'

      earnCoins(db, {
        amount: COIN_REWARDS.CHALLENGE_JOIN,
        category: 'challenges',
        title: `Joined Challenge: ${challenge.title}`,
        description: challenge.description || 'Started habit challenge',
        source: 'challenge_join',
        referenceId: `challenge_${challenge.id}_join`
      })

      await writeDb(db)
      return send(res, 200, challenge)
    }

    if (req.method === 'POST' && path.startsWith('/api/challenges/') && path.endsWith('/complete')) {
      const challengeId = id(path.replace(/\/complete$/, ''))
      const challenge = db.challenges.find(item => String(item.id) === challengeId)
      if (!challenge) return send(res, 404, { error: 'Challenge not found' })

      // Deduplication & idempotency check
      const challengeRef = `challenge_${challenge.id}_complete`
      if (challenge.status === 'completed' || hasTransactionWithReference(db, challengeRef)) {
        return send(res, 400, { error: 'Challenge reward has already been claimed!' })
      }

      challenge.progress = challenge.target
      challenge.status = 'completed'

      const tx = earnCoins(db, {
        amount: challenge.reward,
        category: 'challenges',
        title: `Challenge Completed: ${challenge.title}`,
        description: challenge.description || 'Successfully completed challenge',
        source: 'challenge_completion',
        referenceId: challengeRef
      })

      db.notifications.unshift({
        id: Date.now(),
        text: `${challenge.title} completed — ${challenge.reward} LOOT Coins earned.`,
        icon: '⚡',
        read: false
      })

      await writeDb(db)
      return send(res, 200, { challenge, transaction: tx })
    }

    // ==========================================
    // ASK PARENT / PITCHES & CHORES
    // ==========================================
    if (req.method === 'POST' && path === '/api/pitches') {
      const input = await body(req)
      if (!input.purpose || typeof input.purpose !== 'string' || !input.purpose.trim()) {
        return send(res, 400, { error: 'Pitch purpose is required.' })
      }
      const numAmount = Number(input.amount)
      if (isNaN(numAmount) || numAmount <= 0 || !Number.isFinite(numAmount)) {
        return send(res, 400, { error: 'Pitch amount must be a valid amount greater than 0.' })
      }

      const tasks = Array.isArray(input.tasks)
        ? input.tasks
        : (input.chores || '').split(',').map(title => ({ title: title.trim(), duration: input.duration || '', status: 'proposed' })).filter(t => t.title)

      const pitchId = randomUUID()
      const ownerId = db.profile.email || 'rookie@example.com'

      // Create linked secure Parent Request with cryptographically random token & Supabase sync
      let parentReq = null
      try {
        parentReq = await createParentRequest({
          ownerId,
          pitchId,
          requestType: 'purchase',
          title: `₹${numAmount.toLocaleString('en-IN')} for ${input.purpose.trim()}`,
          description: input.reason || '',
          requestedAmount: numAmount,
          currency: 'INR',
          metadata: { tasks, duration: input.duration || '' }
        }, db, writeDb)
      } catch (err) {
        console.warn('Parent request creation warning:', err.message)
      }

      const pitch = {
        id: pitchId,
        ...input,
        purpose: input.purpose.trim(),
        amount: numAmount,
        status: 'pending',
        shareToken: parentReq ? parentReq.token : randomUUID(),
        parentRequestId: parentReq ? parentReq.id : null,
        parentShareUrl: parentReq ? parentReq.shareUrl : null,
        tasks,
        createdAt: new Date().toISOString()
      }
      db.pitches.unshift(pitch)

      earnCoins(db, {
        amount: COIN_REWARDS.PITCH_CREATE,
        category: 'activities',
        title: `Proposal Drafted: ${pitch.purpose}`,
        description: `Created thoughtful parent pitch for ₹${pitch.amount.toLocaleString('en-IN')}`,
        source: 'pitch_creation',
        referenceId: `pitch_create_${pitch.id}`
      })

      await writeDb(db)
      return send(res, 201, pitch)
    }

    // ==========================================
    // SUPABASE PARENT SHAREABLE REQUESTS API
    // ==========================================

    // Health check endpoint (verifies connection without exposing secret credentials)
    if (req.method === 'GET' && path === '/api/parent-requests/health') {
      const health = await getSupabaseHealth()
      return send(res, health.ok ? 200 : 503, health)
    }

    // Create standalone parent request
    if (req.method === 'POST' && path === '/api/parent-requests') {
      const input = await body(req)
      const ownerId = input.ownerId || db.profile.email || 'rookie@example.com'
      try {
        const result = await createParentRequest({
          ownerId,
          pitchId: input.pitchId,
          requestType: input.requestType || 'purchase',
          title: input.title,
          description: input.description,
          requestedAmount: input.requestedAmount,
          currency: input.currency || 'INR',
          metadata: input.metadata || {}
        }, db, writeDb)
        return send(res, 201, result)
      } catch (err) {
        return send(res, 400, { error: err.message })
      }
    }

    // Public lookup by token for Parent Portal (works without authentication)
    if (req.method === 'GET' && path.startsWith('/api/parent-requests/token/')) {
      const token = path.replace('/api/parent-requests/token/', '')
      const result = await getParentRequestByToken(token, db)
      if (result.error) {
        return send(res, result.status, { error: result.error })
      }
      return send(res, 200, result.request)
    }

    // Public parent decision submission (Approve / Decline / Request Changes)
    if (req.method === 'POST' && path.match(/^\/api\/parent-requests\/token\/([^/]+)\/respond$/)) {
      const matches = path.match(/^\/api\/parent-requests\/token\/([^/]+)\/respond$/)
      const token = matches[1]
      const input = await body(req)
      const result = await submitParentResponse(token, {
        response: input.response,
        message: input.message
      }, db, writeDb)

      if (result.error) {
        return send(res, result.status, { error: result.error })
      }
      return send(res, 200, result)
    }

    // Revoke a pending request (Teen action)
    if (req.method === 'POST' && path.match(/^\/api\/parent-requests\/([^/]+)\/revoke$/)) {
      const matches = path.match(/^\/api\/parent-requests\/([^/]+)\/revoke$/)
      const requestId = matches[1]
      const ownerId = db.profile.email || 'rookie@example.com'
      const result = await revokeParentRequest(requestId, ownerId, db, writeDb)
      if (result.error) {
        return send(res, result.status, { error: result.error })
      }
      return send(res, 200, result)
    }

    // Complete a chore within a pitch to earn coins!
    if (req.method === 'POST' && path.match(/^\/api\/pitches\/([^/]+)\/chores\/(\d+)\/complete$/)) {
      const matches = path.match(/^\/api\/pitches\/([^/]+)\/chores\/(\d+)\/complete$/)
      const pitchId = matches[1]
      const choreIndex = Number(matches[2])

      const pitch = db.pitches.find(item => item.id === pitchId)
      if (!pitch) return send(res, 404, { error: 'Pitch not found' })
      if (!pitch.tasks || !pitch.tasks[choreIndex]) return send(res, 404, { error: 'Chore not found' })

      if (pitch.status === 'revoked') {
        return send(res, 400, { error: 'Chores cannot be completed for a revoked pitch.' })
      }

      const chore = pitch.tasks[choreIndex]
      const choreRef = `chore_${pitch.id}_${choreIndex}_complete`

      if (chore.status === 'completed' || hasTransactionWithReference(db, choreRef)) {
        return send(res, 400, { error: 'Chore reward has already been claimed!' })
      }

      chore.status = 'completed'
      const tx = earnCoins(db, {
        amount: COIN_REWARDS.CHORE_COMPLETE,
        category: 'chores',
        title: `Chore Done: ${chore.title}`,
        description: `Completed chore for pitch "${pitch.purpose}"`,
        source: 'chore_completion',
        referenceId: choreRef
      })

      db.notifications.unshift({
        id: Date.now(),
        text: `Completed chore "${chore.title}" — ${COIN_REWARDS.CHORE_COMPLETE} LOOT Coins earned!`,
        icon: '🧹',
        read: false
      })

      await writeDb(db)
      return send(res, 200, { success: true, chore, transaction: tx })
    }

    if (req.method === 'PATCH' && path.startsWith('/api/pitches/')) {
      const pitch = db.pitches.find(item => String(item.id) === id(path))
      if (!pitch) return send(res, 404, { error: 'Pitch not found' })
      const input = await body(req)

      if (input.status) {
        if (input.status !== 'revoked') {
          return send(res, 403, { error: 'Unauthorized status change. Decisions must be recorded via the secure parent share link.' })
        }
        if (pitch.status !== 'pending') {
          return send(res, 400, { error: `Only pending pitches can be revoked. Current status is ${pitch.status}.` })
        }
        pitch.status = 'revoked'
        // Synchronize linked parent request if exists
        if (pitch.parentRequestId && Array.isArray(db.parentRequests)) {
          const pr = db.parentRequests.find(r => r.id === pitch.parentRequestId)
          if (pr && pr.status === 'pending') {
            pr.status = 'revoked'
            pr.responded_at = new Date().toISOString()
          }
        }
      }

      await writeDb(db)
      return send(res, 200, pitch)
    }

    // ==========================================
    // SMART BUY COMPARISONS & ACHIEVEMENTS
    // ==========================================
    if (req.method === 'POST' && path === '/api/comparisons/record') {
      const input = await body(req)
      const queryOrItem = (input?.item || input?.query || '').trim()
      if (!queryOrItem) {
        return send(res, 400, { error: 'Search query or item name is required for price comparison.' })
      }

      const today = new Date().toISOString().slice(0, 10)

      if (!db.smartBuyStats) {
        db.smartBuyStats = { totalComparisons: 0, lastComparisonDate: today, dailyCount: 0 }
      }
      if (db.smartBuyStats.lastComparisonDate !== today) {
        db.smartBuyStats.lastComparisonDate = today
        db.smartBuyStats.dailyCount = 0
      }

      const isFirstEver = db.smartBuyStats.totalComparisons === 0
      let awardedCoins = 0
      if (db.smartBuyStats.dailyCount < 3) {
        awardedCoins = isFirstEver ? 5 : 2
        db.smartBuyStats.dailyCount += 1
      }
      db.smartBuyStats.totalComparisons += 1

      let tx = null
      if (awardedCoins > 0) {
        tx = earnCoins(db, {
          amount: awardedCoins,
          category: 'smartbuy',
          title: `Smart Buy: ${input.item || 'Price comparison'}`,
          description: `Compared prices across stores${input.savings ? ` (saved ₹${Number(input.savings).toLocaleString('en-IN')})` : ''}`,
          source: 'smartbuy_comparison',
          referenceId: `smartbuy_comp_${Date.now()}`
        })
      }

      let unlockedBadge = false
      const smartShopper = (db.achievements || []).find(item => item.id === 5 || item.title === 'Smart Shopper')
      if (smartShopper && !smartShopper.unlocked && db.smartBuyStats.totalComparisons >= 3) {
        smartShopper.unlocked = true
        unlockedBadge = true
        earnCoins(db, {
          amount: smartShopper.reward || 15,
          category: 'achievements',
          title: `Achievement: ${smartShopper.title}`,
          description: smartShopper.description,
          source: 'achievement_unlock',
          referenceId: `achievement_${smartShopper.id}_unlock`
        })
        db.notifications.unshift({
          id: Date.now(),
          text: 'Achievement unlocked: Smart Shopper! (+15 ✦)',
          icon: '🛍️',
          read: false
        })
      }

      await writeDb(db)
      return send(res, 200, {
        ok: true,
        awardedCoins,
        totalComparisons: db.smartBuyStats.totalComparisons,
        dailyCount: db.smartBuyStats.dailyCount,
        unlockedBadge,
        coins: db.profile.coins,
        transaction: tx
      })
    }

    if (req.method === 'POST' && path.match(/^\/api\/achievements\/([^/]+)\/unlock$/)) {
      const achId = id(path.replace(/\/unlock$/, ''))
      const ach = (db.achievements || []).find(item => String(item.id) === achId || item.title.toLowerCase() === achId.toLowerCase())
      if (!ach) return send(res, 404, { error: 'Achievement not found' })
      if (!ach.unlocked) {
        ach.unlocked = true
        earnCoins(db, {
          amount: ach.reward || 15,
          category: 'achievements',
          title: `Achievement: ${ach.title}`,
          description: ach.description,
          source: 'achievement_unlock',
          referenceId: `achievement_${ach.id}_unlock`
        })
        db.notifications.unshift({
          id: Date.now(),
          text: `Achievement unlocked: ${ach.title}! (+${ach.reward || 15} ✦)`,
          icon: ach.icon || '🛍️',
          read: false
        })
        await writeDb(db)
      }
      return send(res, 200, ach)
    }

    return send(res, 404, { error: 'Route not found' })
  } catch (error) {
    console.error('API Error:', error)
    return send(res, 400, { error: error.message || 'Request failed' })
  }
}).listen(port, () => console.log(`LOOT API & Centralized Coin Engine running at http://localhost:${port}`))
