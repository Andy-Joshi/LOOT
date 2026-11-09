import { randomUUID } from 'node:crypto'
import { writeFileSync, renameSync } from 'node:fs'

/**
 * Centralized LOOT Coin Engine Configuration
 */
export const COIN_REWARDS = {
  GOAL_CREATE: 10,
  GOAL_CONTRIBUTION_DIVISOR: 50, // 1 coin per ₹50 saved
  GOAL_COMPLETE_BONUS: 50,
  TRANSACTION_EXPENSE: 2,
  TRANSACTION_INCOME: 5,
  SPLIT_CREATE: 5,
  BILL_SETTLEMENT: 25,
  POOL_CREATE: 10,
  POOL_CONTRIBUTION_DIVISOR: 100, // 1 coin per ₹100 contributed
  CHALLENGE_JOIN: 5,
  PITCH_CREATE: 5,
  CHORE_COMPLETE: 25,
}

export const RANKS = [
  { level: 1, name: 'Saving Rookie', min: 0, max: 499, color: 'purple' },
  { level: 2, name: 'Money Scout', min: 500, max: 999, color: 'cyan' },
  { level: 3, name: 'Richie Rich', min: 1000, max: 1999, color: 'lime' },
  { level: 4, name: 'Vault King', min: 2000, max: 4999, color: 'yellow' },
  { level: 5, name: 'Loot Legend', min: 5000, max: Infinity, color: 'pink' }
]

export const STORE_ITEMS = [
  {
    id: 'perk-neon-frame',
    name: 'Cyber Neon Avatar Frame',
    category: 'cosmetic',
    price: 150,
    icon: '⚡',
    description: 'A glowing neon lime animated border for your profile avatar.',
    badge: 'PROFILE PERK'
  },
  {
    id: 'perk-streak-shield',
    name: 'Streak Freeze Shield',
    category: 'utility',
    price: 200,
    icon: '🛡️',
    description: 'Protects your saving streak if you miss logging for a day.',
    badge: 'SAVER PERK'
  },
  {
    id: 'perk-gold-badge',
    name: 'Vault Pioneer Gold Badge',
    category: 'badge',
    price: 300,
    icon: '👑',
    description: 'Exclusive badge displayed next to your name across LOOT.',
    badge: 'EXCLUSIVE'
  },
  {
    id: 'perk-xp-boost',
    name: '2X Coin Boost Pass (24h)',
    category: 'boost',
    price: 250,
    icon: '🚀',
    description: 'Earn double coins on all goal saves and habit tracking for 24 hours.',
    badge: 'BOOSTER'
  },
  {
    id: 'perk-arcade-theme',
    name: 'Retro Arcade Theme Pass',
    category: 'theme',
    price: 350,
    icon: '🕹️',
    description: 'Unlocks the 8-bit sound fx & arcade theme palette.',
    badge: 'THEME'
  },
  {
    id: 'perk-parent-voucher',
    name: 'Parent Pitch Priority Pass',
    category: 'perk',
    price: 100,
    icon: '🎫',
    description: 'Highlights your pitch at the top of your parent review queue.',
    badge: 'FAMILY PASS'
  }
]

/**
 * Calculates current rank and level progression based on coin balance
 */
export const calculateRankAndLevel = (coins) => {
  const currentCoins = Math.max(0, Math.round(coins || 0))
  let currentRank = RANKS[0]
  for (const rank of RANKS) {
    if (currentCoins >= rank.min) {
      currentRank = rank
    }
  }

  const isMaxLevel = currentRank.max === Infinity
  const currentLevelMin = currentRank.min
  const nextLevelThreshold = isMaxLevel ? currentRank.min : currentRank.max + 1
  const progressToNext = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, Math.round(((currentCoins - currentLevelMin) / (nextLevelThreshold - currentLevelMin)) * 100)))

  return {
    level: currentRank.level,
    rank: currentRank.name,
    color: currentRank.color,
    currentCoins,
    currentLevelMin,
    nextLevelThreshold,
    progressPercent: progressToNext,
    coinsNeededForNext: isMaxLevel ? 0 : Math.max(0, nextLevelThreshold - currentCoins)
  }
}

/**
 * Mutex queue to guarantee atomic database file persistence
 */
let dbWriteQueue = Promise.resolve()

export const safeAtomicWriteDb = (dbPath, db) => {
  dbWriteQueue = dbWriteQueue.then(() => {
    const tempPath = `${dbPath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 8)}`
    const data = `${JSON.stringify(db, null, 2)}\n`
    writeFileSync(tempPath, data, 'utf8')
    renameSync(tempPath, dbPath)
  }).catch((err) => {
    console.error('Failed to safely persist database:', err)
    throw err
  })
  return dbWriteQueue
}

/**
 * Ensures data integrity and migrates legacy balances safely
 */
export const initializeCoinEngine = (db, dbPath) => {
  let modified = false

  if (!db.profile) {
    db.profile = { id: 1, name: 'User', rank: 'Saving Rookie', coins: 0 }
    modified = true
  }

  if (!Array.isArray(db.coinTransactions)) {
    db.coinTransactions = []
    modified = true
  }

  if (!Array.isArray(db.profile.unlockedPerks)) {
    db.profile.unlockedPerks = []
    modified = true
  }

  // Migrate existing balance safely if no coinTransactions exist
  if (db.coinTransactions.length === 0 && db.profile.coins > 0) {
    const currentCoins = db.profile.coins
    let runningBalance = 0

    // Synthesize historical ledger entries reflecting completed challenges/achievements
    const historicalEntries = []

    // 1. Check completed challenges
    if (Array.isArray(db.challenges)) {
      for (const challenge of db.challenges) {
        if (challenge.status === 'completed' && challenge.reward > 0) {
          runningBalance += challenge.reward
          historicalEntries.push({
            id: `tx-hist-chal-${challenge.id}`,
            type: 'earn',
            amount: challenge.reward,
            balanceAfter: runningBalance,
            category: 'challenges',
            title: `Challenge Completed: ${challenge.title}`,
            description: challenge.description || 'Completed challenge reward',
            source: 'challenge_completion',
            referenceId: `challenge_${challenge.id}_complete`,
            timestamp: new Date(Date.now() - 3600000 * 4).toISOString()
          })
        }
      }
    }

    // 2. Check unlocked achievements
    if (Array.isArray(db.achievements)) {
      for (const achievement of db.achievements) {
        if (achievement.unlocked && achievement.reward > 0) {
          runningBalance += achievement.reward
          historicalEntries.push({
            id: `tx-hist-ach-${achievement.id}`,
            type: 'earn',
            amount: achievement.reward,
            balanceAfter: runningBalance,
            category: 'achievements',
            title: `Achievement Unlocked: ${achievement.title}`,
            description: achievement.description || 'Milestone achievement reward',
            source: 'achievement_unlock',
            referenceId: `achievement_${achievement.id}_unlock`,
            timestamp: new Date(Date.now() - 3600000 * 8).toISOString()
          })
        }
      }
    }

    // 3. Difference from existing balance is allocated to genesis/streak migration
    const difference = currentCoins - runningBalance
    if (difference > 0) {
      historicalEntries.unshift({
        id: 'tx-migration-genesis',
        type: 'earn',
        amount: difference,
        balanceAfter: difference,
        category: 'migration',
        title: 'Legacy Balance Verified & Migrated',
        description: 'Verified historical balance and streak rewards safely imported into Coin Engine',
        source: 'system_migration',
        referenceId: 'legacy_genesis_balance',
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString()
      })

      // Recalculate running balance after unshifting
      let bal = 0
      for (const entry of historicalEntries) {
        bal += entry.amount
        entry.balanceAfter = bal
      }
    } else if (difference < 0) {
      // If historical was higher, add a single entry for current balance
      historicalEntries.length = 0
      historicalEntries.push({
        id: 'tx-migration-initial',
        type: 'earn',
        amount: currentCoins,
        balanceAfter: currentCoins,
        category: 'migration',
        title: 'Initial Balance Migration',
        description: 'Verified initial wallet balance preserved from profile',
        source: 'system_migration',
        referenceId: 'initial_profile_coins',
        timestamp: new Date().toISOString()
      })
    }

    db.coinTransactions = historicalEntries
    modified = true
  }

  // Ensure profile rank is consistent with coin engine levels
  const rankInfo = calculateRankAndLevel(db.profile.coins)
  if (db.profile.rank !== rankInfo.rank) {
    db.profile.rank = rankInfo.rank
    modified = true
  }

  if (modified && dbPath) {
    safeAtomicWriteDb(dbPath, db)
  }

  return db
}

/**
 * Checks if a transaction with the given reference ID already exists.
 * Prevents double-claiming challenges, goals, or idempotency duplicates.
 */
export const hasTransactionWithReference = (db, referenceId) => {
  if (!referenceId || !Array.isArray(db.coinTransactions)) return false
  return db.coinTransactions.some(tx => tx.referenceId === referenceId)
}

/**
 * Centralized method to earn coins.
 * Returns the created transaction object.
 */
export const earnCoins = (db, {
  amount,
  category = 'activities',
  title,
  description,
  source = 'system',
  referenceId = null,
  idempotencyKey = null
}) => {
  const verifiedAmount = Math.max(0, Math.round(Number(amount) || 0))
  if (verifiedAmount <= 0) {
    throw new Error('Coin earn amount must be a positive number')
  }

  // Duplicate prevention check
  const effectiveRef = idempotencyKey || referenceId
  if (effectiveRef && hasTransactionWithReference(db, effectiveRef)) {
    throw new Error(`Reward already granted for reference: ${effectiveRef}`)
  }

  const currentBalance = Math.max(0, Number(db.profile.coins || 0))
  const newBalance = currentBalance + verifiedAmount

  const txId = `tx-earn-${Date.now()}-${randomUUID().slice(0, 8)}`
  const tx = {
    id: txId,
    type: 'earn',
    amount: verifiedAmount,
    balanceAfter: newBalance,
    category,
    title: title || 'LOOT Coins Earned',
    description: description || 'Coins added to your wallet',
    source,
    referenceId: effectiveRef,
    timestamp: new Date().toISOString()
  }

  db.coinTransactions.unshift(tx)
  db.profile.coins = newBalance
  const rankInfo = calculateRankAndLevel(newBalance)
  db.profile.rank = rankInfo.rank

  return tx
}

/**
 * Centralized method to spend coins.
 * Validates sufficient balance, prevents negative balance, records ledger entry.
 */
export const spendCoins = (db, {
  amount,
  category = 'rewards',
  title,
  description,
  source = 'store_redemption',
  referenceId = null,
  idempotencyKey = null
}) => {
  const verifiedAmount = Math.max(0, Math.round(Number(amount) || 0))
  if (verifiedAmount <= 0) {
    throw new Error('Coin spend amount must be a positive number')
  }

  const currentBalance = Math.max(0, Number(db.profile.coins || 0))
  if (currentBalance < verifiedAmount) {
    throw new Error(`Insufficient LOOT Coins. You have ${currentBalance} coins, but need ${verifiedAmount}.`)
  }

  const effectiveRef = idempotencyKey || referenceId
  if (effectiveRef && hasTransactionWithReference(db, effectiveRef)) {
    throw new Error(`Duplicate spend transaction rejected for reference: ${effectiveRef}`)
  }

  const newBalance = currentBalance - verifiedAmount
  const txId = `tx-spend-${Date.now()}-${randomUUID().slice(0, 8)}`
  const tx = {
    id: txId,
    type: 'spend',
    amount: verifiedAmount,
    balanceAfter: newBalance,
    category,
    title: title || 'LOOT Coins Spent',
    description: description || 'Redeemed from your wallet',
    source,
    referenceId: effectiveRef,
    timestamp: new Date().toISOString()
  }

  db.coinTransactions.unshift(tx)
  db.profile.coins = newBalance
  const rankInfo = calculateRankAndLevel(newBalance)
  db.profile.rank = rankInfo.rank

  return tx
}

/**
 * Reverses a transaction safely when appropriate.
 */
export const reverseTransaction = (db, transactionId, reason = 'Administrative reversal') => {
  const originalTx = db.coinTransactions.find(tx => tx.id === transactionId)
  if (!originalTx) {
    throw new Error(`Transaction ${transactionId} not found`)
  }

  if (hasTransactionWithReference(db, `reversal_${transactionId}`)) {
    throw new Error(`Transaction ${transactionId} has already been reversed`)
  }

  const currentBalance = Math.max(0, Number(db.profile.coins || 0))
  let newBalance = currentBalance

  if (originalTx.type === 'earn') {
    if (currentBalance < originalTx.amount) {
      throw new Error(`Cannot reverse transaction: user balance (${currentBalance}) is less than reversal amount (${originalTx.amount})`)
    }
    newBalance = currentBalance - originalTx.amount
  } else if (originalTx.type === 'spend') {
    newBalance = currentBalance + originalTx.amount
  }

  const reversalTx = {
    id: `tx-rev-${Date.now()}-${randomUUID().slice(0, 8)}`,
    type: 'reverse',
    amount: originalTx.amount,
    balanceAfter: newBalance,
    category: 'reversal',
    title: `Reversal: ${originalTx.title}`,
    description: reason || `Reversed transaction ${transactionId}`,
    source: 'reversal',
    referenceId: `reversal_${transactionId}`,
    timestamp: new Date().toISOString()
  }

  db.coinTransactions.unshift(reversalTx)
  db.profile.coins = newBalance
  const rankInfo = calculateRankAndLevel(newBalance)
  db.profile.rank = rankInfo.rank

  return reversalTx
}

/**
 * Computes wallet summary metrics (total earned, total spent, stats)
 */
export const getWalletStats = (db) => {
  const transactions = Array.isArray(db.coinTransactions) ? db.coinTransactions : []
  let totalEarned = 0
  let totalSpent = 0

  for (const tx of transactions) {
    if (tx.type === 'earn') totalEarned += tx.amount
    else if (tx.type === 'spend') totalSpent += tx.amount
  }

  const rankInfo = calculateRankAndLevel(db.profile.coins)

  return {
    balance: db.profile.coins,
    totalEarned,
    totalSpent,
    totalTransactions: transactions.length,
    unlockedPerks: Array.isArray(db.profile.unlockedPerks) ? db.profile.unlockedPerks : [],
    ...rankInfo
  }
}
