import assert from 'node:assert'
import { test, describe, before, after } from 'node:test'
import { copyFileSync, unlinkSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  COIN_REWARDS,
  STORE_ITEMS,
  calculateRankAndLevel,
  initializeCoinEngine,
  hasTransactionWithReference,
  earnCoins,
  spendCoins,
  reverseTransaction,
  getWalletStats
} from '../server/coinEngine.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const originalDbPath = join(rootDir, 'server', 'db.json')
const testDbPath = join(rootDir, 'server', 'test-db.json')

describe('LOOT Centralized Coin Engine - Comprehensive Test Suite', () => {
  before(() => {
    // Make a test copy of existing db.json to guarantee total data isolation
    copyFileSync(originalDbPath, testDbPath)
  })

  after(() => {
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath)
    }
  })

  test('Scenario 8: Existing balances survive migration safely', () => {
    // Andy's original balance in db.json was 1070
    const mockDb = {
      profile: { id: 1, name: 'Andy Joshi', rank: 'Saving Rookie', coins: 1070 },
      challenges: [
        { id: 1, title: 'No-Spend Weekend', reward: 120, status: 'completed' },
        { id: 3, title: 'Track Attack', reward: 80, status: 'completed' }
      ],
      achievements: [
        { id: 1, title: 'First Drop', reward: 50, unlocked: true },
        { id: 2, title: 'Level Up', reward: 100, unlocked: true },
        { id: 3, title: 'Daily Drip', reward: 150, unlocked: true }
      ]
    }

    initializeCoinEngine(mockDb, null)

    assert.strictEqual(mockDb.profile.coins, 1070, 'Coins balance must remain exactly 1070')
    assert.strictEqual(mockDb.coinTransactions.length, 6, 'Must generate verified historical ledger entries')

    // Sum of historical transaction amounts should equal 1070
    const totalEarned = mockDb.coinTransactions.reduce((sum, tx) => sum + tx.amount, 0)
    assert.strictEqual(totalEarned, 1070, 'Total ledger transactions sum must equal 1070')

    // Check rank calculation
    assert.strictEqual(mockDb.profile.rank, 'Richie Rich', 'Rank must update to Richie Rich for 1070 coins')
  })

  test('Scenario 1: Completing a goal awards the correct coins', () => {
    const db = {
      profile: { id: 1, name: 'Andy', coins: 1000 },
      coinTransactions: [],
      goals: []
    }

    // 1. Goal creation
    const txCreate = earnCoins(db, {
      amount: COIN_REWARDS.GOAL_CREATE,
      category: 'goals',
      title: 'New Goal: Drone',
      source: 'goal_creation',
      referenceId: 'goal_create_999'
    })

    assert.strictEqual(txCreate.amount, 10, 'Creating goal must award 10 coins')
    assert.strictEqual(db.profile.coins, 1010, 'Balance must be 1010')

    // 2. Goal contribution: ₹500 saved -> Math.round(500 / 50) = 10 coins
    const txContrib = earnCoins(db, {
      amount: Math.round(500 / COIN_REWARDS.GOAL_CONTRIBUTION_DIVISOR),
      category: 'goals',
      title: 'Goal Contribution: Drone',
      source: 'goal_contribution',
      referenceId: 'goal_contrib_999_1'
    })

    assert.strictEqual(txContrib.amount, 10, 'Contribution must award 10 coins')
    assert.strictEqual(db.profile.coins, 1020, 'Balance must be 1020')

    // 3. Goal complete bonus
    const txBonus = earnCoins(db, {
      amount: COIN_REWARDS.GOAL_COMPLETE_BONUS,
      category: 'goals',
      title: 'Goal Complete: Drone',
      source: 'goal_completion',
      referenceId: 'goal_complete_999'
    })

    assert.strictEqual(txBonus.amount, 50, 'Goal completion bonus must award 50 coins')
    assert.strictEqual(db.profile.coins, 1070, 'Balance must be 1070')
  })

  test('Scenario 2: Completing a challenge receives the correct reward', () => {
    const db = {
      profile: { id: 1, name: 'Andy', coins: 500 },
      coinTransactions: []
    }

    const challenge = { id: 2, title: 'Daily Drip', reward: 200 }
    const tx = earnCoins(db, {
      amount: challenge.reward,
      category: 'challenges',
      title: `Challenge Completed: ${challenge.title}`,
      description: 'Saved every day this week',
      source: 'challenge_completion',
      referenceId: `challenge_${challenge.id}_complete`
    })

    assert.strictEqual(tx.amount, 200, 'Must award 200 coins')
    assert.strictEqual(db.profile.coins, 700, 'Balance must increase to 700')
    assert.strictEqual(tx.category, 'challenges')
  })

  test('Scenario 3: A user receives coins only once for a given reward (duplicate prevention)', () => {
    const db = {
      profile: { id: 1, name: 'Andy', coins: 500 },
      coinTransactions: []
    }

    const ref = 'challenge_2_complete'
    earnCoins(db, {
      amount: 200,
      category: 'challenges',
      title: 'Daily Drip',
      referenceId: ref
    })

    assert.strictEqual(db.profile.coins, 700)
    assert.strictEqual(hasTransactionWithReference(db, ref), true)

    // Attempting to award again with same reference must throw
    assert.throws(() => {
      earnCoins(db, {
        amount: 200,
        category: 'challenges',
        title: 'Daily Drip',
        referenceId: ref
      })
    }, /already granted/i, 'Must reject duplicate reward for the same reference')

    // Balance must remain unchanged at 700
    assert.strictEqual(db.profile.coins, 700, 'Balance must not increase on duplicate claim')
  })

  test('Scenario 4: A user spends coins successfully', () => {
    const db = {
      profile: { id: 1, name: 'Andy', coins: 500, unlockedPerks: [] },
      coinTransactions: []
    }

    const item = STORE_ITEMS.find(i => i.id === 'perk-neon-frame') // price: 150
    assert(item, 'Item must exist in store catalog')

    const tx = spendCoins(db, {
      amount: item.price,
      category: 'rewards',
      title: `Redeemed: ${item.name}`,
      description: item.description,
      source: 'reward_store',
      referenceId: `store_${item.id}_test`
    })

    assert.strictEqual(tx.amount, 150, 'Must deduct 150 coins')
    assert.strictEqual(db.profile.coins, 350, 'Balance must reduce from 500 to 350')
    assert.strictEqual(tx.type, 'spend')
    assert.strictEqual(tx.balanceAfter, 350)
  })

  test('Scenario 5: A user cannot spend more coins than their balance', () => {
    const db = {
      profile: { id: 1, name: 'Andy', coins: 100, unlockedPerks: [] },
      coinTransactions: []
    }

    // Try to spend 150 when balance is 100
    assert.throws(() => {
      spendCoins(db, {
        amount: 150,
        category: 'rewards',
        title: 'Cyber Neon Frame'
      })
    }, /Insufficient LOOT Coins/i, 'Must prevent negative balance')

    assert.strictEqual(db.profile.coins, 100, 'Balance must remain intact')
  })

  test('Scenario 6: Wallet metrics calculate and update immediately', () => {
    const db = {
      profile: { id: 1, name: 'Andy', coins: 1070 },
      coinTransactions: [
        { id: '1', type: 'earn', amount: 1000, balanceAfter: 1000, category: 'migration' },
        { id: '2', type: 'earn', amount: 120, balanceAfter: 1120, category: 'challenges' },
        { id: '3', type: 'spend', amount: 50, balanceAfter: 1070, category: 'rewards' }
      ]
    }

    const stats = getWalletStats(db)
    assert.strictEqual(stats.balance, 1070)
    assert.strictEqual(stats.totalEarned, 1120)
    assert.strictEqual(stats.totalSpent, 50)
    assert.strictEqual(stats.level, 3)
    assert.strictEqual(stats.rank, 'Richie Rich')
    assert.strictEqual(stats.currentLevelMin, 1000)
    assert.strictEqual(stats.nextLevelThreshold, 2000)
    assert.strictEqual(stats.coinsNeededForNext, 930)
  })

  test('Scenario 7: Reversal works and respects balance boundaries', () => {
    const db = {
      profile: { id: 1, name: 'Andy', coins: 200 },
      coinTransactions: [
        { id: 'tx-test-earn', type: 'earn', amount: 50, balanceAfter: 200, title: 'Bonus' }
      ]
    }

    const revTx = reverseTransaction(db, 'tx-test-earn', 'Test reversal')
    assert.strictEqual(revTx.type, 'reverse')
    assert.strictEqual(revTx.amount, 50)
    assert.strictEqual(db.profile.coins, 150)
    assert.strictEqual(revTx.balanceAfter, 150)
  })

  test('Scenario 9: Rank progression is accurately computed', () => {
    assert.strictEqual(calculateRankAndLevel(250).rank, 'Saving Rookie')
    assert.strictEqual(calculateRankAndLevel(750).rank, 'Money Scout')
    assert.strictEqual(calculateRankAndLevel(1250).rank, 'Richie Rich')
    assert.strictEqual(calculateRankAndLevel(2500).rank, 'Vault King')
    assert.strictEqual(calculateRankAndLevel(6000).rank, 'Loot Legend')
  })

  test('Scenario 10: Store items catalog is valid and complete', () => {
    assert.strictEqual(STORE_ITEMS.length >= 6, true, 'Must have at least 6 configured store perks')
    for (const item of STORE_ITEMS) {
      assert(item.id, 'Store item must have ID')
      assert(item.name, 'Store item must have name')
      assert(typeof item.price === 'number' && item.price > 0, 'Price must be positive number')
      assert(item.icon, 'Store item must have icon')
    }
  })
})
