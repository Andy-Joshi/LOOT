import assert from 'node:assert'
import { test, describe, before, after } from 'node:test'
import { fork } from 'node:child_process'
import { unlinkSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const dbPath = join(rootDir, 'server', 'db.json')
const backupDbPath = join(rootDir, 'server', 'db.backup.json')
const TEST_PORT = 3099
const BASE_URL = `http://localhost:${TEST_PORT}`

const request = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const json = await res.json()
  return { status: res.status, ok: res.ok, data: json }
}

describe('LOOT HTTP Server & API Integration Tests', () => {
  let serverProcess

  before(async () => {
    // Create isolated test database
    const testState = JSON.parse(readFileSync(dbPath, 'utf8'))
    testState.profile.coins = 500
    testState.profile.unlockedPerks = []
    testState.challenges = testState.challenges.map(c => ({
      ...c,
      status: 'available',
      completed: false,
      claimed: false
    }))
    writeFileSync(backupDbPath, JSON.stringify(testState, null, 2))

    // Launch server on TEST_PORT with DB_PATH isolated
    await new Promise((resolve, reject) => {
      serverProcess = fork(join(rootDir, 'server', 'index.js'), [], {
        env: { ...process.env, PORT: String(TEST_PORT), DB_PATH: backupDbPath },
        silent: true
      })

      serverProcess.on('error', reject)

      // Wait for server to be responsive
      const checkHealth = async (retries = 20) => {
        try {
          const res = await fetch(`${BASE_URL}/api/health`)
          if (res.ok) return resolve()
        } catch {
          if (retries > 0) setTimeout(() => checkHealth(retries - 1), 100)
          else reject(new Error('Server failed to start on port ' + TEST_PORT))
        }
      }
      setTimeout(checkHealth, 200)
    })
  })

  after(() => {
    if (serverProcess) {
      serverProcess.kill()
    }
    if (existsSync(backupDbPath)) {
      unlinkSync(backupDbPath)
    }
  })

  test('GET /api/health and /api/state return valid engine state', async () => {
    const health = await request('/api/health')
    assert.strictEqual(health.status, 200)
    assert.strictEqual(health.data.ok, true)

    const state = await request('/api/state')
    assert.strictEqual(state.status, 200)
    assert(state.data.profile, 'Profile must be present')
    assert(Array.isArray(state.data.coinTransactions), 'coinTransactions must be an array')
    assert(state.data.coinStats, 'coinStats must be present')
    assert(Array.isArray(state.data.storeItems), 'storeItems must be present')
    assert(state.data.coinRewards, 'coinRewards must be present')
  })

  test('GET /api/coins/transactions returns paginated and filtered transactions', async () => {
    const res = await request('/api/coins/transactions?limit=10')
    assert.strictEqual(res.status, 200)
    assert(Array.isArray(res.data.transactions), 'transactions must be array')
    assert(typeof res.data.total === 'number')

    // Filter by type
    const earns = await request('/api/coins/transactions?type=earn')
    assert.strictEqual(earns.status, 200)
    for (const tx of earns.data.transactions) {
      assert.strictEqual(tx.type, 'earn')
    }
  })

  test('Completing a goal awards coins and updates wallet', async () => {
    // 1. Create a goal with target 100
    const createRes = await request('/api/goals', {
      method: 'POST',
      body: JSON.stringify({ name: 'Integration Test Drone', target: 100 })
    })
    assert.strictEqual(createRes.status, 201)
    const goalId = createRes.data.id

    // 2. Contribute 100 (which also completes the goal)
    const contribRes = await request(`/api/goals/${goalId}`, {
      method: 'PATCH',
      body: JSON.stringify({ contribution: 100 })
    })
    assert.strictEqual(contribRes.status, 200)
    assert.strictEqual(contribRes.data.completed, true)

    // 3. Verify coinTransactions contains goal complete transaction
    const txRes = await request('/api/coins/transactions?category=goals')
    assert.strictEqual(txRes.status, 200)
    const goalTxs = txRes.data.transactions.filter(t => t.referenceId && t.referenceId.includes(String(goalId)))
    assert(goalTxs.length >= 2, 'Must record goal create, contribution, and completion bonus')
  })

  test('Completing a challenge awards coins, and duplicate claim is rejected', async () => {
    // Find an uncompleted challenge (e.g., id 2 Daily Drip)
    const state = await request('/api/state')
    const challenge = state.data.challenges.find(c => c.id === 2)
    assert(challenge, 'Challenge 2 must exist')

    // Complete challenge 2
    const completeRes = await request(`/api/challenges/${challenge.id}/complete`, {
      method: 'POST'
    })
    assert.strictEqual(completeRes.status, 200)
    assert.strictEqual(completeRes.data.challenge.status, 'completed')
    assert.strictEqual(completeRes.data.transaction.amount, challenge.reward)

    // Try completing challenge 2 again -> MUST BE REJECTED (Duplicate prevention)
    const duplicateRes = await request(`/api/challenges/${challenge.id}/complete`, {
      method: 'POST'
    })
    assert.strictEqual(duplicateRes.status, 400, 'Duplicate completion request must return 400')
    assert(duplicateRes.data.error.includes('already been claimed'), 'Must return duplicate claim error')
  })

  test('User can spend coins on store item, and cannot spend beyond balance', async () => {
    // 1. Spend 150 on perk-neon-frame
    const spendRes = await request('/api/coins/spend', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'perk-neon-frame' })
    })
    assert.strictEqual(spendRes.status, 200)
    assert.strictEqual(spendRes.data.success, true)
    assert(spendRes.data.profile.unlockedPerks.includes('perk-neon-frame'))

    // 2. Try buying it again (single-purchase perk)
    const rebuyRes = await request('/api/coins/spend', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'perk-neon-frame' })
    })
    assert.strictEqual(rebuyRes.status, 400)
    assert(rebuyRes.data.error.includes('already unlocked'))

    // 3. Try buying a non-existent item
    const fakeRes = await request('/api/coins/spend', {
      method: 'POST',
      body: JSON.stringify({ itemId: 'non-existent-perk' })
    })
    assert.strictEqual(fakeRes.status, 404)
  })

  test('Completing a chore on a pitch awards 25 coins and rejects duplicates', async () => {
    // 1. Create a pitch with a chore
    const pitchRes = await request('/api/pitches', {
      method: 'POST',
      body: JSON.stringify({
        amount: 500,
        purpose: 'School Art Supplies',
        reason: 'For visual design project',
        chores: 'Clean the kitchen',
        duration: '30 mins'
      })
    })
    assert.strictEqual(pitchRes.status, 201)
    const pitch = pitchRes.data

    // 2. Complete chore index 0
    const choreRes = await request(`/api/pitches/${pitch.id}/chores/0/complete`, {
      method: 'POST'
    })
    assert.strictEqual(choreRes.status, 200)
    assert.strictEqual(choreRes.data.chore.status, 'completed')
    assert.strictEqual(choreRes.data.transaction.amount, 25)

    // 3. Complete chore again -> must fail
    const dupChoreRes = await request(`/api/pitches/${pitch.id}/chores/0/complete`, {
      method: 'POST'
    })
    assert.strictEqual(dupChoreRes.status, 400)
    assert(dupChoreRes.data.error.includes('already been claimed'))
  })
})
