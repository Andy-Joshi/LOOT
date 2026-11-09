import assert from 'node:assert'
import { test, describe, before, after } from 'node:test'
import { fork } from 'node:child_process'
import { copyFileSync, unlinkSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const originalDbPath = join(rootDir, 'server', 'db.json')
const isolatedDbPath = join(rootDir, 'server', 'db.mode-test.json')
const TEST_PORT = 3198
const BASE_URL = `http://localhost:${TEST_PORT}`

const request = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const json = await res.json()
  return { status: res.status, ok: res.ok, data: json }
}

describe('Experience Mode Switching (New User vs Test User)', () => {
  let serverProcess

  before(async () => {
    copyFileSync(originalDbPath, isolatedDbPath)

    await new Promise((resolve, reject) => {
      serverProcess = fork(join(rootDir, 'server', 'index.js'), [], {
        env: {
          ...process.env,
          PORT: String(TEST_PORT),
          DB_PATH: isolatedDbPath
        },
        silent: true
      })

      serverProcess.on('error', reject)

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
    if (serverProcess) serverProcess.kill()
    if (existsSync(isolatedDbPath)) {
      unlinkSync(isolatedDbPath)
    }
  })

  test('Switching to new_user (Rookie Journey) resets to clean state starting from scratch', async () => {
    const res = await request('/api/profile/experience-mode', {
      method: 'POST',
      body: JSON.stringify({ mode: 'new_user' })
    })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.profile.experienceMode, 'new_user')
    assert.strictEqual(res.data.profile.name, 'Rookie Saver')
    assert.strictEqual(res.data.profile.coins, 0)
    assert.strictEqual(res.data.profile.rank, 'Saving Rookie')
    assert.strictEqual(res.data.profile.streak, 0, 'New user starts with 0 streak')
    assert.strictEqual(res.data.goals.length, 0, 'New user starts with 0 goals')
    assert.strictEqual(res.data.transactions.length, 0, 'New user starts with 0 transactions')
    assert.strictEqual(res.data.coinTransactions.length, 0, 'New user starts with 0 coin transactions')
    assert.strictEqual(res.data.pools.length, 0, 'New user starts with 0 pools')
    assert.strictEqual(res.data.pitches.length, 0, 'New user starts with 0 pitches')
    assert.ok(res.data.challenges.every(c => !c.joined), 'No challenges joined initially')
    assert.ok(res.data.achievements.every(a => !a.unlocked), 'All achievements locked')
  })

  test('In new_user mode, user can lodge first transaction and earn coins from scratch', async () => {
    const txRes = await request('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ title: 'First Rookie Spend', amount: -150, category: 'Lifestyle' })
    })

    assert.strictEqual(txRes.status, 201)
    assert.strictEqual(txRes.data.title, 'First Rookie Spend')

    const stateRes = await request('/api/state')
    assert.strictEqual(stateRes.data.transactions.length, 1)
    assert.strictEqual(stateRes.data.profile.coins, 2, 'Earned 2 coins for logging first transaction')
  })

  test('Switching to test_user (Loaded Vault) restores full demo account with done transactions', async () => {
    const res = await request('/api/profile/experience-mode', {
      method: 'POST',
      body: JSON.stringify({ mode: 'test_user' })
    })

    assert.strictEqual(res.status, 200)
    assert.strictEqual(res.data.profile.experienceMode, 'test_user')
    assert.strictEqual(res.data.profile.name, 'Andy Joshi')
    assert.strictEqual(res.data.profile.coins, 620)
    assert.strictEqual(res.data.profile.rank, 'Money Scout')
    assert(res.data.goals.length >= 3, 'Test user has pre-loaded goals')
    assert(res.data.transactions.length >= 4, 'Test user has transactions already done')
    assert(res.data.coinTransactions.length >= 4, 'Test user has ledger history')
  })
})
