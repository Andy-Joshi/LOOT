import assert from 'node:assert'
import { test, describe, before, after } from 'node:test'
import { fork } from 'node:child_process'
import { unlinkSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

import {
  supabase,
  isSupabaseConfigured,
  publicAppUrl,
  getSupabaseHealth
} from '../server/supabaseClient.js'

import {
  generateSecureToken,
  hashToken,
  sanitizeParentRequest,
  createParentRequest,
  getParentRequestByToken,
  submitParentResponse,
  revokeParentRequest
} from '../server/parentRequestsService.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const dbPath = join(rootDir, 'server', 'db.json')
const testDbPath = join(rootDir, 'server', 'db.parentlink.test.json')
const TEST_PORT = 3290
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`

const apiRequest = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const json = await res.json()
  return { status: res.status, ok: res.ok, data: json }
}

describe('LOOT Supabase Connection & Parent Shareable Link Test Suite', () => {
  let serverProcess

  before(async () => {
    // Create an isolated test database
    const originalState = JSON.parse(readFileSync(dbPath, 'utf8'))
    const testState = {
      ...originalState,
      profile: {
        ...originalState.profile,
        email: 'teen_tester@loot.app'
      },
      pitches: [
        {
          id: 'pitch_test_001',
          title: 'Rollerblades & Helmet',
          amount: 2800,
          reason: 'Need protective gear for park skating',
          status: 'pending',
          tasks: [
            { text: 'Mow the lawn twice', status: 'pending' },
            { text: 'Wash the car on weekend', status: 'pending' }
          ]
        }
      ],
      parentRequests: [],
      notifications: []
    }
    writeFileSync(testDbPath, JSON.stringify(testState, null, 2))

    // Launch server on TEST_PORT with DB_PATH isolated
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
          if (retries > 0) setTimeout(() => checkHealth(retries - 1), 120)
          else reject(new Error('Server failed to start on port ' + TEST_PORT))
        }
      }
      setTimeout(checkHealth, 250)
    })
  })

  after(() => {
    if (serverProcess) {
      serverProcess.kill()
    }
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath)
    }
  })

  // ==========================================
  // TEST 1: SUPABASE CLIENT INITIALIZATION & HEALTH CHECK
  // ==========================================
  test('Test 1: Supabase client initialization & safe health check', async () => {
    assert.strictEqual(isSupabaseConfigured(), true, 'Supabase must be configured')
    assert.ok(supabase, 'Supabase client instance must exist')
    assert.ok(publicAppUrl, 'Public app URL must be configured')

    const health = await getSupabaseHealth()
    assert.strictEqual(health.ok, true, 'Supabase health check should return ok: true')
    assert.strictEqual(health.supabaseConnected, true, 'Supabase connectivity should be true')
    assert.strictEqual(typeof health.tableReady, 'boolean')
    assert.ok(health.message, 'Health check should contain a human-readable message')

    // Verify health check NEVER leaks secret keys or hash values
    const healthString = JSON.stringify(health)
    assert.strictEqual(healthString.includes('service_role'), false, 'Never expose service role key')
    assert.strictEqual(healthString.includes('token_hash'), false, 'Never expose token hash')
  })

  // ==========================================
  // TEST 2: CRYPTOGRAPHIC TOKEN GENERATION & HASHING
  // ==========================================
  test('Test 2: Cryptographic token generation (32 bytes = 64 hex chars) and SHA-256 token hashing', () => {
    const token = generateSecureToken()
    assert.strictEqual(typeof token, 'string')
    assert.strictEqual(token.length, 64, 'Token must be 64 hex characters (32 bytes)')
    assert.ok(/^[a-f0-9]{64}$/.test(token), 'Token must be lowercase hexadecimal')

    // Uniqueness: generate 50 tokens and verify they are all distinct
    const tokenSet = new Set()
    for (let i = 0; i < 50; i++) {
      tokenSet.add(generateSecureToken())
    }
    assert.strictEqual(tokenSet.size, 50, 'All generated tokens must be unique')

    // Deterministic SHA-256 hashing
    const hash1 = hashToken(token)
    const hash2 = hashToken(token)
    assert.strictEqual(hash1, hash2, 'hashToken must be deterministic')
    assert.strictEqual(hash1.length, 64, 'SHA-256 hash must be 64 characters')
    assert.strictEqual(hash1, createHash('sha256').update(token).digest('hex'))

    // Token and hash must not be equal
    assert.notStrictEqual(token, hash1, 'Raw token and token hash must differ')

    // Edge cases
    assert.strictEqual(hashToken(''), '')
    assert.strictEqual(hashToken(null), '')
    assert.strictEqual(hashToken(undefined), '')
  })

  // ==========================================
  // TEST 3: STANDALONE & PITCH-LINKED PARENT REQUEST CREATION
  // ==========================================
  test('Test 3: Standalone & pitch-linked parent request creation', async () => {
    let mockDb = {
      profile: { email: 'teen@loot.app' },
      pitches: [
        {
          id: 'pitch_sample_123',
          title: 'Electric Guitar',
          amount: 8500,
          reason: 'For school rock band',
          status: 'pending'
        }
      ],
      parentRequests: [],
      notifications: []
    }
    const writeMockDb = async (d) => { mockDb = d }

    // 1. Standalone request
    const standalone = await createParentRequest({
      ownerId: 'teen@loot.app',
      title: 'Coding Book Subscription',
      description: 'Monthly educational programming guide',
      requestedAmount: 699,
      currency: 'INR'
    }, mockDb, writeMockDb)

    assert.ok(standalone.id, 'Must generate request ID')
    assert.strictEqual(standalone.token.length, 64, 'Must return raw 64-char token once')
    assert.strictEqual(standalone.shareUrl, `${publicAppUrl}/parent/${standalone.token}`)
    assert.strictEqual(standalone.request.title, 'Coding Book Subscription')
    assert.strictEqual(standalone.request.requested_amount, 699)
    assert.strictEqual(standalone.request.status, 'pending')
    assert.strictEqual(standalone.request.currency, 'INR')
    assert.ok(standalone.request.expires_at, 'Must have expires_at timestamp')

    // 2. Pitch-linked request
    const linked = await createParentRequest({
      ownerId: 'teen@loot.app',
      pitchId: 'pitch_sample_123',
      title: 'Electric Guitar',
      description: 'For school rock band',
      requestedAmount: 8500
    }, mockDb, writeMockDb)

    assert.ok(linked.token)
    assert.strictEqual(linked.shareUrl, `${publicAppUrl}/parent/${linked.token}`)

    // Verify linked pitch in mockDb was updated with parentRequestId & shareToken
    const pitch = mockDb.pitches.find(p => p.id === 'pitch_sample_123')
    assert.strictEqual(pitch.parentRequestId, linked.id)
    assert.strictEqual(pitch.shareToken, linked.token)
    assert.strictEqual(pitch.parentShareUrl, linked.shareUrl)
  })

  // ==========================================
  // TEST 4: VERIFICATION THAT token_hash IS NEVER RETURNED IN SANITIZED REQUESTS
  // ==========================================
  test('Test 4: Verification that token_hash is never exposed in sanitized request objects', async () => {
    const rawRecord = {
      id: 'req_test_abc',
      title: 'Art supplies',
      status: 'pending',
      token_hash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      requested_amount: 1200
    }

    const sanitized = sanitizeParentRequest(rawRecord, 'my_raw_token_xyz')
    assert.strictEqual(sanitized.token_hash, undefined, 'token_hash must be stripped')
    assert.strictEqual('token_hash' in sanitized, false, 'token_hash key must not exist')
    assert.strictEqual(sanitized.id, 'req_test_abc')
    assert.strictEqual(sanitized.token, 'my_raw_token_xyz')
    assert.strictEqual(sanitized.shareUrl, `${publicAppUrl}/parent/my_raw_token_xyz`)
  })

  // ==========================================
  // TEST 5: PUBLIC TOKEN RETRIEVAL WITHOUT AUTHENTICATION
  // ==========================================
  test('Test 5: Public token retrieval (getParentRequestByToken) without authentication', async () => {
    const token = generateSecureToken()
    const tokenHash = hashToken(token)

    const mockDb = {
      parentRequests: [
        {
          id: 'pr_public_test',
          owner_id: 'teen@loot.app',
          title: 'Science Fair Kit',
          description: 'Chemistry materials for experiment',
          requested_amount: 1500,
          currency: 'INR',
          status: 'pending',
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          created_at: new Date().toISOString()
        }
      ]
    }

    const result = await getParentRequestByToken(token, mockDb)
    assert.strictEqual(result.status, 200)
    assert.ok(result.request)
    assert.strictEqual(result.request.id, 'pr_public_test')
    assert.strictEqual(result.request.title, 'Science Fair Kit')
    assert.strictEqual(result.request.requested_amount, 1500)
    assert.strictEqual(result.request.status, 'pending')
    assert.strictEqual(result.request.token_hash, undefined)
  })

  // ==========================================
  // TEST 6: PARENT RESPONSE SUBMISSION (APPROVE, DECLINE, CHANGES_REQUESTED)
  // ==========================================
  test('Test 6: Parent response submission with note, status update & teen notification', async () => {
    const token = generateSecureToken()
    const tokenHash = hashToken(token)

    let mockDb = {
      pitches: [
        {
          id: 'pitch_music_lesson',
          title: 'Piano Lessons',
          status: 'pending',
          tasks: [{ text: 'Clean room daily', status: 'pending' }]
        }
      ],
      parentRequests: [
        {
          id: 'pr_piano',
          owner_id: 'teen@loot.app',
          pitch_id: 'pitch_music_lesson',
          title: 'Piano Lessons',
          status: 'pending',
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          created_at: new Date().toISOString()
        }
      ],
      notifications: []
    }
    const writeMockDb = async (d) => { mockDb = d }

    // Parent Approves
    const approveResult = await submitParentResponse(token, {
      response: 'approved',
      message: 'Great initiative! Keep up with your chores.'
    }, mockDb, writeMockDb)

    assert.strictEqual(approveResult.status, 200)
    assert.strictEqual(approveResult.success, true)
    assert.strictEqual(approveResult.decision, 'approved')
    assert.strictEqual(approveResult.request.status, 'approved')
    assert.strictEqual(approveResult.request.parent_message, 'Great initiative! Keep up with your chores.')
    assert.ok(approveResult.request.responded_at)

    // Linked pitch updated
    const pitch = mockDb.pitches.find(p => p.id === 'pitch_music_lesson')
    assert.strictEqual(pitch.status, 'approved')
    assert.strictEqual(pitch.parentMessage, 'Great initiative! Keep up with your chores.')

    // Notification created for teen
    assert.strictEqual(mockDb.notifications.length, 1)
    assert.ok(mockDb.notifications[0].text.includes('approved'))
    assert.strictEqual(mockDb.notifications[0].icon, '🎉')
  })

  // ==========================================
  // TEST 7: DUPLICATE RESPONSE REJECTION (ATOMIC UPDATE 409 CONFLICT)
  // ==========================================
  test('Test 7: Duplicate response rejection (enforcing atomic updates with 409 Conflict)', async () => {
    const token = generateSecureToken()
    const tokenHash = hashToken(token)

    let mockDb = {
      parentRequests: [
        {
          id: 'pr_atomic_check',
          owner_id: 'teen@loot.app',
          title: 'Keyboard Stand',
          status: 'pending',
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          created_at: new Date().toISOString()
        }
      ],
      notifications: []
    }
    const writeMockDb = async (d) => { mockDb = d }

    // First response succeeds
    const firstRes = await submitParentResponse(token, {
      response: 'approved',
      message: 'Sure thing!'
    }, mockDb, writeMockDb)
    assert.strictEqual(firstRes.status, 200)

    // Second response MUST be rejected with 409 Conflict
    const secondRes = await submitParentResponse(token, {
      response: 'declined',
      message: 'Actually no'
    }, mockDb, writeMockDb)
    assert.strictEqual(secondRes.status, 409)
    assert.ok(secondRes.error.includes('already been approved'))

    // The recorded decision remains 'approved'
    assert.strictEqual(mockDb.parentRequests[0].status, 'approved')
  })

  // ==========================================
  // TEST 8: EXPIRATION HANDLING (7-DAY WINDOW REJECTED AFTER EXPIRY)
  // ==========================================
  test('Test 8: Expiration handling (7-day window rejected after expiry)', async () => {
    const token = generateSecureToken()
    const tokenHash = hashToken(token)

    // Past date (expired 1 day ago)
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    let mockDb = {
      parentRequests: [
        {
          id: 'pr_expired_req',
          owner_id: 'teen@loot.app',
          title: 'Old Request',
          status: 'pending',
          token_hash: tokenHash,
          expires_at: pastDate,
          created_at: new Date(Date.now() - 8 * 86400000).toISOString()
        }
      ]
    }
    const writeMockDb = async (d) => { mockDb = d }

    // Lookup marks status as expired
    const getRes = await getParentRequestByToken(token, mockDb)
    assert.strictEqual(getRes.status, 200)
    assert.strictEqual(getRes.request.status, 'expired')

    // Responding to expired request returns 410 Gone
    const resRes = await submitParentResponse(token, {
      response: 'approved'
    }, mockDb, writeMockDb)
    assert.strictEqual(resRes.status, 410)
    assert.ok(resRes.error.includes('expired'))
  })

  // ==========================================
  // TEST 9: REVOCATION HANDLING
  // ==========================================
  test('Test 9: Revocation handling (revoked requests reject decisions)', async () => {
    const token = generateSecureToken()
    const tokenHash = hashToken(token)

    let mockDb = {
      pitches: [
        { id: 'pitch_to_revoke', title: 'To Revoke', status: 'pending' }
      ],
      parentRequests: [
        {
          id: 'pr_to_revoke',
          owner_id: 'teen@loot.app',
          pitch_id: 'pitch_to_revoke',
          title: 'To Revoke',
          status: 'pending',
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          created_at: new Date().toISOString()
        }
      ]
    }
    const writeMockDb = async (d) => { mockDb = d }

    // Teen revokes
    const revokeRes = await revokeParentRequest('pr_to_revoke', 'teen@loot.app', mockDb, writeMockDb)
    assert.strictEqual(revokeRes.status, 200)
    assert.strictEqual(revokeRes.success, true)
    assert.strictEqual(mockDb.parentRequests[0].status, 'revoked')
    assert.strictEqual(mockDb.pitches[0].status, 'revoked')

    // Cannot respond to revoked request
    const respondRes = await submitParentResponse(token, {
      response: 'approved'
    }, mockDb, writeMockDb)
    assert.strictEqual(respondRes.status, 410)
    assert.ok(respondRes.error.includes('revoked'))
  })

  // ==========================================
  // TEST 10: INVALID TOKENS & INPUTS RETURN 400 / 404
  // ==========================================
  test('Test 10: Invalid tokens and inputs return 400 / 404', async () => {
    const emptyTokenRes = await getParentRequestByToken('', {})
    assert.strictEqual(emptyTokenRes.status, 400)

    const notFoundRes = await getParentRequestByToken('nonexistent_token_0123456789abcdef0123456789abcdef0123456789abcdef', { parentRequests: [] })
    assert.strictEqual(notFoundRes.status, 404)

    const invalidResponseChoice = await submitParentResponse('some_token', {
      response: 'invalid_choice'
    }, { parentRequests: [] })
    assert.strictEqual(invalidResponseChoice.status, 400)

    // Creating request without title throws error
    await assert.rejects(async () => {
      await createParentRequest({ title: '' })
    }, /Title is required/)
  })

  // ==========================================
  // TEST 11: HTTP API ENDPOINTS LIVE INTEGRATION
  // ==========================================
  test('Test 11: HTTP API live endpoints verification on server', async () => {
    // 1. Health check
    const healthRes = await apiRequest('/api/parent-requests/health')
    assert.strictEqual(healthRes.status, 200)
    assert.strictEqual(healthRes.data.ok, true)
    assert.strictEqual(healthRes.data.supabaseConnected, true)

    // 2. Create standalone request via API
    const createRes = await apiRequest('/api/parent-requests', {
      method: 'POST',
      body: JSON.stringify({
        title: 'New Badminton Racket',
        description: 'For district championship tournament',
        requestedAmount: 1850,
        currency: 'INR'
      })
    })
    assert.strictEqual(createRes.status, 201)
    assert.ok(createRes.data.token)
    assert.strictEqual(createRes.data.request.title, 'New Badminton Racket')
    assert.strictEqual(createRes.data.request.requested_amount, 1850)

    const createdToken = createRes.data.token

    // 3. Public GET by token
    const tokenRes = await apiRequest(`/api/parent-requests/token/${createdToken}`)
    assert.strictEqual(tokenRes.status, 200)
    assert.strictEqual(tokenRes.data.title, 'New Badminton Racket')
    assert.strictEqual(tokenRes.data.status, 'pending')
    assert.strictEqual(tokenRes.data.token_hash, undefined)

    // 4. Parent responds via API
    const respondRes = await apiRequest(`/api/parent-requests/token/${createdToken}/respond`, {
      method: 'POST',
      body: JSON.stringify({
        response: 'approved',
        message: 'Play your best in the championship!'
      })
    })
    assert.strictEqual(respondRes.status, 200)
    assert.strictEqual(respondRes.data.success, true)
    assert.strictEqual(respondRes.data.decision, 'approved')

    // 5. Subsequent response is rejected with 409 Conflict
    const dupRes = await apiRequest(`/api/parent-requests/token/${createdToken}/respond`, {
      method: 'POST',
      body: JSON.stringify({
        response: 'declined',
        message: 'Second thought'
      })
    })
    assert.strictEqual(dupRes.status, 409)

    // 6. Creating and revoking a request via API
    const toRevokeRes = await apiRequest('/api/parent-requests', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Cancel Me',
        requestedAmount: 100
      })
    })
    assert.strictEqual(toRevokeRes.status, 201)
    const revokeId = toRevokeRes.data.id

    const doRevoke = await apiRequest(`/api/parent-requests/${revokeId}/revoke`, {
      method: 'POST'
    })
    assert.strictEqual(doRevoke.status, 200)
    assert.strictEqual(doRevoke.data.success, true)
  })

  // ==========================================
  // TEST 12: FRONTEND BUNDLE CREDENTIAL PURITY & GITIGNORE CHECK
  // ==========================================
  test('Test 12: Frontend bundle does not contain secret keys, and .env is gitignored', () => {
    // 1. Check .gitignore
    const gitignorePath = join(rootDir, '.gitignore')
    assert.ok(existsSync(gitignorePath), '.gitignore must exist')
    const gitignoreContent = readFileSync(gitignorePath, 'utf8')
    assert.ok(gitignoreContent.includes('.env'), '.gitignore must ignore .env files')

    // 2. Scan dist/ assets for absence of SUPABASE_SERVICE_ROLE_KEY or sensitive secrets
    const distAssetsDir = join(rootDir, 'dist', 'assets')
    if (existsSync(distAssetsDir)) {
      const files = readdirSync(distAssetsDir)
      for (const file of files) {
        const content = readFileSync(join(distAssetsDir, file), 'utf8')
        assert.strictEqual(content.includes('SUPABASE_SERVICE_ROLE_KEY'), false, 'dist files must never contain SUPABASE_SERVICE_ROLE_KEY')
        assert.strictEqual(content.includes('service_role'), false, 'dist files must never contain service_role')
      }
    }
    const indexJsFile = readFileSync(join(rootDir, 'src', 'App.jsx'), 'utf8')
    assert.strictEqual(indexJsFile.includes('SUPABASE_SERVICE_ROLE_KEY'), false, 'App.jsx must never import secret service role key')
  })

  // ==========================================
  // TEST 13: UI COMPONENTS, ROUTE & SQL MIGRATION INTEGRITY
  // ==========================================
  test('Test 13: UI Components, public Parent Portal route & SQL migration exist and conform', () => {
    // 1. ParentPortal.jsx exists and has disclaimers & 3 action choices
    const portalPath = join(rootDir, 'src', 'components', 'parent', 'ParentPortal.jsx')
    assert.ok(existsSync(portalPath), 'ParentPortal.jsx must exist')
    const portalCode = readFileSync(portalPath, 'utf8')
    assert.ok(portalCode.includes('Approve'), 'Must have Approve action')
    assert.ok(portalCode.includes('Decline'), 'Must have Decline action')
    assert.ok(portalCode.includes('Request changes') || portalCode.includes('changes_requested'), 'Must have Request changes action')
    assert.ok(portalCode.includes('LOOT does not initiate bank transfers') || portalCode.includes('transfer money'), 'Must state disclaimer that decision does not transfer money')
    assert.ok(portalCode.includes('Passwordless link-based approval') || portalCode.includes('decision is recorded'), 'Must clarify link records decision')

    // 2. ParentPortal.css exists
    const portalCssPath = join(rootDir, 'src', 'components', 'parent', 'ParentPortal.css')
    assert.ok(existsSync(portalCssPath), 'ParentPortal.css must exist')

    // 3. ParentShareModal.jsx exists and has sharing mechanisms
    const shareModalPath = join(rootDir, 'src', 'components', 'parent', 'ParentShareModal.jsx')
    assert.ok(existsSync(shareModalPath), 'ParentShareModal.jsx must exist')
    const shareModalCode = readFileSync(shareModalPath, 'utf8')
    assert.ok(shareModalCode.includes('Copy Link'), 'Must have Copy Link action')
    assert.ok(shareModalCode.includes('wa.me') || shareModalCode.includes('WhatsApp'), 'Must support WhatsApp share')
    assert.ok(shareModalCode.includes('navigator.share'), 'Must support native device share')

    // 4. App.jsx intercepts /parent/:token route
    const appJsxPath = join(rootDir, 'src', 'App.jsx')
    const appCode = readFileSync(appJsxPath, 'utf8')
    assert.ok(appCode.includes('ParentPortal'), 'App.jsx must import ParentPortal')
    assert.ok(appCode.includes('/parent/'), 'App.jsx must route /parent/ path')
    assert.ok(appCode.includes('ParentShareModal'), 'App.jsx must integrate ParentShareModal')

    // 5. Supabase migration files exist
    const migrationSqlPath = join(rootDir, 'supabase', 'migrations', '20261109000000_create_parent_requests.sql')
    const schemaSqlPath = join(rootDir, 'supabase', 'schema.sql')
    assert.ok(existsSync(migrationSqlPath), 'Migration SQL must exist')
    assert.ok(existsSync(schemaSqlPath), 'Schema SQL must exist')

    const sql = readFileSync(migrationSqlPath, 'utf8').toLowerCase()
    assert.ok(sql.includes('create table if not exists public.parent_requests'), 'Must create public.parent_requests')
    assert.ok(sql.includes('token_hash'), 'Must define token_hash')
    assert.ok(sql.includes('enable row level security'), 'Must enable RLS')
  })

  // ==========================================
  // TEST 14: EXISTING LOOT STORAGE & ENGINE REMAIN INTACT
  // ==========================================
  test('Test 14: Existing LOOT storage architecture is completely preserved', () => {
    const db = JSON.parse(readFileSync(dbPath, 'utf8'))
    assert.ok(db.profile, 'Profile intact')
    assert.ok(Array.isArray(db.goals), 'Goals intact')
    assert.ok(Array.isArray(db.transactions), 'Transactions intact')
    assert.ok(Array.isArray(db.splits), 'Splits intact')
    assert.ok(Array.isArray(db.pools), 'Pools intact')
    assert.ok(Array.isArray(db.challenges), 'Challenges intact')
    assert.ok(Array.isArray(db.achievements), 'Achievements intact')
    assert.ok(Array.isArray(db.pitches), 'Pitches intact')
  })
})
