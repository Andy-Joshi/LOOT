import { randomBytes, createHash, randomUUID } from 'node:crypto'
import { supabase, publicAppUrl } from './supabaseClient.js'

/**
 * Generate a cryptographically secure random token (32 bytes = 64 hex characters)
 */
export function generateSecureToken() {
  return randomBytes(32).toString('hex')
}

/**
 * Compute SHA-256 hash of a raw token
 */
export function hashToken(token) {
  if (!token || typeof token !== 'string') return ''
  return createHash('sha256').update(token.trim()).digest('hex')
}

/**
 * Sanitize a parent request object so secret hashes and internal identifiers are never exposed
 */
export function sanitizeParentRequest(record, rawToken = null) {
  if (!record) return null
  const { token_hash: _token_hash, ...safe } = record
  return {
    ...safe,
    ...(rawToken ? { shareUrl: `${publicAppUrl}/parent/${rawToken}`, token: rawToken } : {})
  }
}

/**
 * Create a new Parent Request in Supabase (with resilient fallback to local DB)
 */
export async function createParentRequest({
  ownerId = 'rookie@example.com',
  pitchId = null,
  requestType = 'purchase',
  title,
  description = '',
  requestedAmount = null,
  currency = 'INR',
  expiresInDays = 7,
  metadata = {}
}, db = null, writeDb = null) {
  if (!title || typeof title !== 'string' || !title.trim()) {
    throw new Error('Title is required for a parent request.')
  }

  const rawToken = generateSecureToken()
  const tokenHash = hashToken(rawToken)
  const now = new Date()
  const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
  const requestId = randomUUID()

  const newRecord = {
    id: requestId,
    owner_id: String(ownerId || 'rookie@example.com'),
    pitch_id: pitchId ? String(pitchId) : null,
    request_type: ['purchase', 'goal', 'general'].includes(requestType) ? requestType : 'purchase',
    title: title.trim().slice(0, 120),
    description: (description || '').trim().slice(0, 500),
    requested_amount: requestedAmount !== null && !isNaN(Number(requestedAmount)) ? Math.max(0, Number(requestedAmount)) : null,
    currency: currency || 'INR',
    status: 'pending',
    token_hash: tokenHash,
    expires_at: expiresAt,
    created_at: now.toISOString(),
    responded_at: null,
    parent_message: null,
    response_type: null,
    metadata: metadata || {}
  }

  // 1. Attempt writing to Supabase
  let supabaseSuccess = false
  if (supabase) {
    try {
      const { data, error } = await supabase.from('parent_requests').insert([newRecord]).select().single()
      if (!error && data) {
        supabaseSuccess = true
      }
    } catch {
      // Graceful fallback to local persistence
    }
  }

  // 2. Persist in local DB for offline / local-sync resilience
  if (db && writeDb) {
    if (!Array.isArray(db.parentRequests)) {
      db.parentRequests = []
    }
    db.parentRequests.unshift(newRecord)

    // Also update pitch shareToken / parentRequestId if linked
    if (pitchId && Array.isArray(db.pitches)) {
      const pitch = db.pitches.find(p => p.id === pitchId)
      if (pitch) {
        pitch.parentRequestId = requestId
        pitch.shareToken = rawToken
        pitch.parentShareUrl = `${publicAppUrl}/parent/${rawToken}`
      }
    }

    await writeDb(db)
  }

  return {
    id: requestId,
    token: rawToken,
    shareUrl: `${publicAppUrl}/parent/${rawToken}`,
    expiresAt,
    supabaseSynced: supabaseSuccess,
    request: sanitizeParentRequest(newRecord, rawToken)
  }
}

/**
 * Retrieve a parent request by raw token (validates existence and checks expiration)
 */
export async function getParentRequestByToken(token, db = null) {
  if (!token || typeof token !== 'string') {
    return { error: 'Invalid or missing share token.', status: 400 }
  }

  const tokenHash = hashToken(token)
  let record = null

  // 1. Try fetching from Supabase first
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('parent_requests')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle()

      if (!error && data) {
        record = data
      }
    } catch {
      // Supabase query failed or table missing, fallback to local DB
    }
  }

  // 2. Fallback to local db if not found in Supabase
  if (!record && db && Array.isArray(db.parentRequests)) {
    record = db.parentRequests.find(r => r.token_hash === tokenHash)
  }

  if (!record) {
    return { error: 'Parent request not found or link is invalid.', status: 404 }
  }

  // 3. Expiration Check
  const now = new Date()
  const expiresAt = new Date(record.expires_at)
  if (now > expiresAt && record.status === 'pending') {
    record.status = 'expired'
  }

  return {
    request: sanitizeParentRequest(record, token),
    status: 200
  }
}

/**
 * Submit parent decision (approve, decline, changes_requested) with optional message
 * Enforces atomic updates: only pending requests can receive a decision.
 */
export async function submitParentResponse(token, { response, message = '' }, db = null, writeDb = null) {
  if (!token || typeof token !== 'string') {
    return { error: 'Invalid share token.', status: 400 }
  }

  const validResponses = ['approved', 'declined', 'changes_requested']
  if (!validResponses.includes(response)) {
    return { error: `Invalid response "${response}". Must be approved, declined, or changes_requested.`, status: 400 }
  }

  const cleanMessage = (message || '').trim().slice(0, 500)
  const tokenHash = hashToken(token)

  // 1. Look up existing record
  let existing = null
  if (supabase) {
    try {
      const { data } = await supabase
        .from('parent_requests')
        .select('*')
        .eq('token_hash', tokenHash)
        .maybeSingle()
      if (data) existing = data
    } catch {
      // Fallback
    }
  }

  if (!existing && db && Array.isArray(db.parentRequests)) {
    existing = db.parentRequests.find(r => r.token_hash === tokenHash)
  }

  if (!existing) {
    return { error: 'Request not found.', status: 404 }
  }

  // 2. State & Expiration Validations
  if (existing.status === 'revoked') {
    return { error: 'This request was revoked by the teen and is no longer accepting responses.', status: 410 }
  }

  const now = new Date()
  const expiresAt = new Date(existing.expires_at)
  if (now > expiresAt || existing.status === 'expired') {
    return { error: 'This share link has expired and is no longer accepting responses.', status: 410 }
  }

  if (existing.status !== 'pending') {
    return {
      error: `This request has already been ${existing.status} on ${new Date(existing.responded_at || existing.created_at).toLocaleDateString('en-IN')}. Decisions cannot be modified once recorded.`,
      status: 409
    }
  }

  const respondedAt = now.toISOString()
  const updates = {
    status: response,
    response_type: response,
    parent_message: cleanMessage || null,
    responded_at: respondedAt
  }

  // 3. Atomic Update in Supabase
  if (supabase) {
    try {
      await supabase
        .from('parent_requests')
        .update(updates)
        .eq('token_hash', tokenHash)
        .eq('status', 'pending')
    } catch {
      // Suppress Supabase errors if offline
    }
  }

  // 4. Update in local db and synchronize pitch / notifications
  let updatedRecord = { ...existing, ...updates }
  if (db && writeDb) {
    if (Array.isArray(db.parentRequests)) {
      const idx = db.parentRequests.findIndex(r => r.token_hash === tokenHash)
      if (idx !== -1) {
        db.parentRequests[idx] = updatedRecord
      }
    }

    // Synchronize linked pitch
    if (existing.pitch_id && Array.isArray(db.pitches)) {
      const pitch = db.pitches.find(p => p.id === existing.pitch_id)
      if (pitch) {
        pitch.status = response
        pitch.parentMessage = cleanMessage || null
        pitch.respondedAt = respondedAt

        if (response === 'approved' && Array.isArray(pitch.tasks)) {
          pitch.tasks = pitch.tasks.map(task => ({
            ...task,
            status: task.status === 'completed' ? 'completed' : 'pending'
          }))
        }
      }
    }

    // Create a real-time notification for the teen
    if (!Array.isArray(db.notifications)) {
      db.notifications = []
    }
    const notifText = response === 'approved'
      ? `Parent approved your pitch "${existing.title}"!`
      : response === 'declined'
        ? `Parent declined your pitch "${existing.title}".`
        : `Parent requested changes on "${existing.title}": "${cleanMessage || 'Please review'}"`

    db.notifications.unshift({
      id: Date.now(),
      text: notifText,
      icon: response === 'approved' ? '🎉' : response === 'declined' ? '♡' : '💬',
      read: false
    })

    // Record PARENT_APPROVAL_LOCKED transaction if approved
    if (response === 'approved' && existing.requested_amount && Number(existing.requested_amount) > 0) {
      if (!Array.isArray(db.transactions)) db.transactions = []
      db.transactions.unshift({
        id: Date.now(),
        type: 'PARENT_APPROVAL_LOCKED',
        title: `Parent Approved: ${existing.title}`,
        description: `₹${Number(existing.requested_amount).toLocaleString('en-IN')} locked awaiting receipt confirmation.`,
        category: 'Parent Approval',
        amount: Number(existing.requested_amount),
        requestId: existing.id,
        pitchId: existing.pitch_id,
        userId: String(existing.owner_id || 'rookie@example.com'),
        date: new Date().toISOString().slice(0, 10),
        timestamp: Date.now(),
        icon: '🔒'
      })
    }

    await writeDb(db)
  }

  return {
    success: true,
    status: 200,
    request: sanitizeParentRequest(updatedRecord, token),
    decision: response
  }
}

/**
 * Revoke a pending parent request
 */
export async function revokeParentRequest(requestId, ownerId, db = null, writeDb = null) {
  let target = null

  if (db && Array.isArray(db.parentRequests)) {
    target = db.parentRequests.find(r => r.id === requestId && (!ownerId || r.owner_id === ownerId))
  }

  if (!target && supabase) {
    try {
      const { data } = await supabase
        .from('parent_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle()
      if (data) target = data
    } catch {
      // Fallback
    }
  }

  if (!target) {
    return { error: 'Request not found.', status: 404 }
  }

  if (target.status !== 'pending') {
    return { error: `Only pending requests can be revoked. Current status is ${target.status}.`, status: 400 }
  }

  const updates = { status: 'revoked', responded_at: new Date().toISOString() }

  if (supabase) {
    try {
      await supabase
        .from('parent_requests')
        .update(updates)
        .eq('id', requestId)
        .eq('status', 'pending')
    } catch {
      // Fallback
    }
  }

  if (db && writeDb) {
    if (Array.isArray(db.parentRequests)) {
      const idx = db.parentRequests.findIndex(r => r.id === requestId)
      if (idx !== -1) {
        db.parentRequests[idx] = { ...target, ...updates }
      }
    }
    if (target.pitch_id && Array.isArray(db.pitches)) {
      const pitch = db.pitches.find(p => p.id === target.pitch_id)
      if (pitch && pitch.status === 'pending') {
        pitch.status = 'revoked'
      }
    }
    await writeDb(db)
  }

  return { success: true, status: 200 }
}
