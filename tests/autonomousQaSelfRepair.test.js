import assert from 'node:assert'
import { test, describe, before, after } from 'node:test'
import { fork } from 'node:child_process'
import { unlinkSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const dbPath = join(rootDir, 'server', 'db.json')
const testDbPath = join(rootDir, 'server', 'db.qa-repair.json')
const TEST_PORT = 3388
const BASE_URL = `http://localhost:${TEST_PORT}`

const request = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    json = null
  }
  return { status: res.status, ok: res.ok, data: json }
}

describe('LOOT Autonomous QA, Bug Hunt & Self-Repair Test Suite', () => {
  let serverProcess

  before(async () => {
    // Read clean base state
    const baseState = JSON.parse(readFileSync(dbPath, 'utf8'))
    const testState = {
      ...baseState,
      profile: {
        ...baseState.profile,
        coins: 100,
        openingBalance: 1000
      },
      goals: [
        {
          id: 991,
          name: 'QA Test Goal',
          category: 'Gear',
          target: 5000,
          saved: 0,
          color: 'lime',
          icon: '🎯',
          contributions: []
        }
      ],
      transactions: [
        {
          id: 9901,
          type: 'MONEY_ADDED',
          amount: 1000,
          title: 'Opening Balance',
          category: 'Essentials',
          date: new Date().toISOString().slice(0, 10),
          timestamp: Date.now() - 100000
        }
      ],
      pitches: [
        {
          id: 992,
          amount: 1500,
          purpose: 'QA Test Pitch',
          reason: 'Need for testing',
          status: 'pending',
          tasks: [
            { title: 'Test chore 1', duration: '30 mins', status: 'proposed' },
            { title: 'Test chore 2', duration: '1 hour', status: 'proposed' }
          ]
        }
      ],
      parentRequests: [],
      pools: []
    }

    writeFileSync(testDbPath, JSON.stringify(testState, null, 2))

    await new Promise((resolve, reject) => {
      serverProcess = fork(join(rootDir, 'server', 'index.js'), [], {
        env: { ...process.env, PORT: String(TEST_PORT), DB_PATH: testDbPath },
        silent: true
      })

      serverProcess.on('error', reject)

      const checkHealth = async (retries = 25) => {
        try {
          const res = await fetch(`${BASE_URL}/api/health`)
          if (res.ok) return resolve()
        } catch {
          if (retries > 0) setTimeout(() => checkHealth(retries - 1), 100)
          else reject(new Error('Test server failed to start on port ' + TEST_PORT))
        }
      }
      setTimeout(checkHealth, 200)
    })
  })

  after(async () => {
    if (serverProcess) {
      serverProcess.kill('SIGTERM')
    }
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath)
    }
  })

  // 1. INPUT VALIDATION & SECURITY DEFENSE
  describe('Input Validation & Exploit Defenses', () => {
    test('POST /api/goals: Rejects empty name or invalid target amount', async () => {
      const resEmpty = await request('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ name: '', target: 500 })
      })
      assert.strictEqual(resEmpty.status, 400)
      assert.match(resEmpty.data.error, /name/i)

      const resZeroTarget = await request('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ name: 'Sneakers', target: 0 })
      })
      assert.strictEqual(resZeroTarget.status, 400)
      assert.match(resZeroTarget.data.error, /target must be a valid amount greater than 0/i)

      const resNegTarget = await request('/api/goals', {
        method: 'POST',
        body: JSON.stringify({ name: 'Sneakers', target: -200 })
      })
      assert.strictEqual(resNegTarget.status, 400)
    })

    test('PATCH /api/goals/:id: Rejects zero or negative contribution (free coin exploit)', async () => {
      const resZero = await request('/api/goals/991', {
        method: 'PATCH',
        body: JSON.stringify({ contribution: 0 })
      })
      assert.strictEqual(resZero.status, 400)
      assert.match(resZero.data.error, /contribution amount must be greater than 0/i)

      const resNeg = await request('/api/goals/991', {
        method: 'PATCH',
        body: JSON.stringify({ contribution: -100 })
      })
      assert.strictEqual(resNeg.status, 400)
    })

    test('POST /api/transactions: Rejects empty title or zero/NaN amount (free coin exploit)', async () => {
      const resZero = await request('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ title: 'Coffee', amount: 0 })
      })
      assert.strictEqual(resZero.status, 400)
      assert.match(resZero.data.error, /non-zero/i)

      const resEmptyTitle = await request('/api/transactions', {
        method: 'POST',
        body: JSON.stringify({ title: '   ', amount: 50 })
      })
      assert.strictEqual(resEmptyTitle.status, 400)
      assert.match(resEmptyTitle.data.error, /title (?:is required|cannot be empty)/i)
    })

    test('POST /api/pools: Rejects empty name or non-positive target', async () => {
      const resZeroPool = await request('/api/pools', {
        method: 'POST',
        body: JSON.stringify({ name: '', target: 1000 })
      })
      assert.strictEqual(resZeroPool.status, 400)

      const resNegTarget = await request('/api/pools', {
        method: 'POST',
        body: JSON.stringify({ name: 'Roadtrip', target: -500 })
      })
      assert.strictEqual(resNegTarget.status, 400)
    })

    test('PATCH /api/pools/:id: Rejects zero or negative contribution and does not award free coins', async () => {
      const poolRes = await request('/api/pools', {
        method: 'POST',
        body: JSON.stringify({ name: 'Weekend Trip', target: 2000 })
      })
      assert.strictEqual(poolRes.status, 201)
      const poolId = poolRes.data.id

      const resZeroContrib = await request(`/api/pools/${poolId}`, {
        method: 'PATCH',
        body: JSON.stringify({ contribution: 0 })
      })
      assert.strictEqual(resZeroContrib.status, 400)
    })

    test('POST /api/pitches: Rejects empty purpose or non-positive amount', async () => {
      const resEmpty = await request('/api/pitches', {
        method: 'POST',
        body: JSON.stringify({ purpose: '', amount: 500 })
      })
      assert.strictEqual(resEmpty.status, 400)

      const resZeroAmt = await request('/api/pitches', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'Books', amount: 0 })
      })
      assert.strictEqual(resZeroAmt.status, 400)
    })
  })

  // 2. SAVINGS GOALS LIFECYCLE & CONSERVATION OF MONEY
  describe('Savings Goals Lifecycle & Funds Conservation', () => {
    let createdGoalId = null

    test('Create valid goal and verify fields', async () => {
      const res = await request('/api/goals', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Sony Headphones',
          category: 'Gear',
          target: 4000,
          deadline: '2026-12-31'
        })
      })
      assert.strictEqual(res.status, 201)
      assert.strictEqual(res.data.name, 'Sony Headphones')
      assert.strictEqual(res.data.target, 4000)
      assert.strictEqual(res.data.saved, 0)
      createdGoalId = res.data.id
    })

    test('Edit goal fields with PATCH /api/goals/:id', async () => {
      const editRes = await request(`/api/goals/${createdGoalId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Sony WH-1000XM5',
          target: 4500,
          weeklySavingsPace: 500
        })
      })
      assert.strictEqual(editRes.status, 200)
      assert.strictEqual(editRes.data.name, 'Sony WH-1000XM5')
      assert.strictEqual(editRes.data.target, 4500)
      assert.strictEqual(editRes.data.weeklySavingsPace, 500)
    })

    test('Contribute to goal and verify balance separation', async () => {
      const contribRes = await request(`/api/goals/${createdGoalId}`, {
        method: 'PATCH',
        body: JSON.stringify({ contribution: 1000 })
      })
      assert.strictEqual(contribRes.status, 200)
      assert.strictEqual(contribRes.data.saved, 1000)

      const breakdownRes = await request('/api/wallet/breakdown')
      assert.strictEqual(breakdownRes.status, 200)
      assert.strictEqual(breakdownRes.data.goalSavings, 1000)
    })

    test('Deleting goal with savings refunds money to available balance', async () => {
      const beforeBreakdown = await request('/api/wallet/breakdown')
      const beforeAvailable = beforeBreakdown.data.availableBalance

      const delRes = await request(`/api/goals/${createdGoalId}`, {
        method: 'DELETE'
      })
      assert.strictEqual(delRes.status, 200)

      const afterBreakdown = await request('/api/wallet/breakdown')
      assert.strictEqual(afterBreakdown.data.goalSavings, 0)
      // Funds should have been refunded back to available
      assert.strictEqual(afterBreakdown.data.availableBalance, beforeAvailable + 1000)
      assert.strictEqual(afterBreakdown.data.totalOwnedMoney, afterBreakdown.data.availableBalance)
    })
  })

  // 3. PITCHES & CHORE PERMISSION INTEGRITY
  describe('Pitches & Chore Security Integrity', () => {
    test('PATCH /api/pitches/:id: Prevents unauthorized client status manipulation', async () => {
      const hackRes = await request('/api/pitches/992', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'approved' })
      })
      assert.strictEqual(hackRes.status, 403)
      assert.match(hackRes.data.error, /unauthorized.*status/i)
    })

    test('POST /api/pitches/:id/chores/:choreIndex/complete: Blocked on revoked pitches', async () => {
      // Create pitch and revoke it
      const pitchRes = await request('/api/pitches', {
        method: 'POST',
        body: JSON.stringify({
          purpose: 'Drone',
          amount: 3000,
          tasks: [{ title: 'Mow lawn', duration: '1 hour', status: 'proposed' }]
        })
      })
      assert.strictEqual(pitchRes.status, 201)
      const pitchId = pitchRes.data.id

      // Revoke the pitch
      const revokeRes = await request(`/api/pitches/${pitchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'revoked' })
      })
      assert.strictEqual(revokeRes.status, 200)
      assert.strictEqual(revokeRes.data.status, 'revoked')

      // Attempt chore completion on revoked pitch
      const choreRes = await request(`/api/pitches/${pitchId}/chores/0/complete`, {
        method: 'POST'
      })
      assert.strictEqual(choreRes.status, 400)
      assert.match(choreRes.data.error, /revoked pitch/i)
    })
  })

  // 4. PARENT LINK TOKEN SECURITY & IDEMPOTENCY
  describe('Parent Link Token Security & Idempotency', () => {
    let generatedToken = null

    test('Parent link generation creates secure token and strips token_hash from response', async () => {
      const linkRes = await request('/api/parent-requests', {
        method: 'POST',
        body: JSON.stringify({
          pitchId: 992,
          requestedAmount: 1500,
          title: 'QA Test Pitch Request',
          description: 'Need for testing'
        })
      })
      assert.strictEqual(linkRes.status, 201)
      assert.ok(linkRes.data.token)
      assert.strictEqual(linkRes.data.token_hash, undefined, 'token_hash must never be leaked to client')
      assert.strictEqual(linkRes.data.request?.token_hash, undefined)
      generatedToken = linkRes.data.token
    })

    test('Retrieving parent request by token succeeds and masks internal hash', async () => {
      const getRes = await request(`/api/parent-requests/token/${generatedToken}`)
      assert.strictEqual(getRes.status, 200)
      assert.strictEqual(getRes.data.token_hash, undefined)
      assert.strictEqual(getRes.data.requested_amount, 1500)
      assert.strictEqual(getRes.data.status, 'pending')
    })

    test('Retrieving parent request with invalid token returns 404', async () => {
      const badRes = await request('/api/parent-requests/token/invalid-token-12345')
      assert.strictEqual(badRes.status, 404)
    })

    test('Parent approval updates status and locks funds', async () => {
      const approveRes = await request(`/api/parent-requests/token/${generatedToken}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          response: 'approved',
          message: 'Approved for test!'
        })
      })
      assert.strictEqual(approveRes.status, 200)
      assert.strictEqual(approveRes.data.request.status, 'approved')

      const breakdown = await request('/api/wallet/breakdown')
      assert.strictEqual(breakdown.data.lockedFunds, 1500)
    })

    test('Repeated parent approval/decision is rejected with 409 Conflict (idempotency)', async () => {
      const repeatRes = await request(`/api/parent-requests/token/${generatedToken}/respond`, {
        method: 'POST',
        body: JSON.stringify({
          response: 'approved',
          message: 'Repeated approval!'
        })
      })
      assert.strictEqual(repeatRes.status, 409)
      assert.match(repeatRes.data.error, /already been (?:approved|responded|processed)/i)
    })
  })

  // 5. SMART BUY RESILIENCE
  describe('Smart Buy Resilience', () => {
    test('POST /api/comparisons/record requires query and awards coins up to daily cap', async () => {
      const badReq = await request('/api/comparisons/record', {
        method: 'POST',
        body: JSON.stringify({})
      })
      assert.strictEqual(badReq.status, 400)
      assert.match(badReq.data.error, /required/i)

      const goodReq = await request('/api/comparisons/record', {
        method: 'POST',
        body: JSON.stringify({ query: 'Wireless Mouse', savings: 200 })
      })
      assert.strictEqual(goodReq.status, 200)
      assert.strictEqual(goodReq.data.ok, true)
    })
  })
})
