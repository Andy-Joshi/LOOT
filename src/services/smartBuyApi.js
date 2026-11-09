/**
 * Smart Buy API Service Module
 *
 * Connects the LOOT application to the standalone Smart Buy Lab comparison backend.
 * Uses configurable base URLs from environment variables and Vite proxies.
 * Handles timeouts, network errors, and store rate-limiting gracefully without crashing.
 */

import { SAMPLE_IPHONE_DATA } from '../data/smartBuySampleData.js'

// Base URL resolution:
// In browser Vite dev environment: uses '/api/smartbuy' (Vite dev proxy rewrites to Smart Buy backend)
// In direct/production calls: uses import.meta.env.VITE_SMARTBUY_API_URL or fallback
export const getSmartBuyBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location && window.location.origin) {
    // Vite proxy handles /api/smartbuy -> http://localhost:5000/api
    return '/api/smartbuy'
  }
  return (
    (typeof process !== 'undefined' && process.env?.VITE_SMARTBUY_API_URL) ||
    'http://localhost:5000/api'
  )
}

const DEFAULT_TIMEOUT_MS = 14000

/**
 * Helper to check whether input string is an online store product URL
 */
export function isProductUrl(val) {
  if (!val || typeof val !== 'string') return false
  const str = val.trim().toLowerCase()
  return (
    /^https?:\/\//.test(str) ||
    str.startsWith('www.') ||
    str.includes('amazon.in') ||
    str.includes('flipkart.com') ||
    str.includes('croma.com') ||
    str.includes('reliancedigital.in') ||
    str.includes('vijaysales.com')
  )
}

/**
 * Execute a fetch with an automatic abort timeout
 */
async function fetchWithTimeout(resource, options = {}) {
  const { timeout = DEFAULT_TIMEOUT_MS, ...fetchOptions } = options
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(resource, {
      ...fetchOptions,
      signal: controller.signal,
    })
    clearTimeout(id)
    return response
  } catch (error) {
    clearTimeout(id)
    if (error.name === 'AbortError') {
      const timeoutErr = new Error(`Request timed out after ${Math.round(timeout / 1000)}s`)
      timeoutErr.isTimeout = true
      throw timeoutErr
    }
    throw error
  }
}

/**
 * Search for best prices by product name or query
 *
 * @param {string} query - Product name (e.g. "iPhone 17 Pro")
 * @param {Object} [options] - Optional timeout and signal override
 * @returns {Promise<Object>} Comparison result
 */
export async function searchProductByName(query, options = {}) {
  const trimmed = (query || '').trim()
  if (!trimmed) {
    throw new Error('Please enter a product name or paste a store link.')
  }

  const baseUrl = getSmartBuyBaseUrl()
  const endpoint = `${baseUrl}/search?q=${encodeURIComponent(trimmed)}`

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      ...options,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      if (res.status === 429) {
        const err = new Error(data.error || 'Rate limit exceeded. Please wait a moment before searching again.')
        err.status = 429
        throw err
      }
      if (res.status === 400) {
        const err = new Error(data.error || 'Invalid search query. Please try searching for a brand and model.')
        err.status = 400
        throw err
      }
      const err = new Error(data.error || data.message || `Store comparison service returned HTTP ${res.status}`)
      err.status = res.status
      throw err
    }

    return data
  } catch (err) {
    if (err.isTimeout) {
      throw new Error('Comparison search timed out. Retailers may be slow or rate-limiting. Please try again.')
    }
    if (err.status) {
      throw err
    }
    // Network failure / server offline
    const netErr = new Error('Smart Buy engine is unreachable. Please verify that the backend is running on port 5000.')
    netErr.isNetworkError = true
    throw netErr
  }
}

/**
 * Search for best prices by direct product URL
 *
 * @param {string} url - Store product URL
 * @param {Object} [options] - Optional timeout
 * @returns {Promise<Object>} Comparison result
 */
export async function searchProductByUrl(url, options = {}) {
  const trimmed = (url || '').trim()
  if (!trimmed) {
    throw new Error('Please enter a valid product link.')
  }

  const baseUrl = getSmartBuyBaseUrl()
  const endpoint = `${baseUrl}/search/url`

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ url: trimmed }),
      ...options,
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      if (res.status === 429) {
        const err = new Error(data.error || 'Rate limit exceeded. Please wait a moment before searching again.')
        err.status = 429
        throw err
      }
      if (res.status === 400) {
        const err = new Error(data.error || 'Could not parse product details from this link. Try searching by product name.')
        err.status = 400
        err.isBlocked = data.diagnostics?.status === 'BLOCKED_INVALID_URL'
        throw err
      }
      const err = new Error(data.error || data.message || `Store comparison service returned HTTP ${res.status}`)
      err.status = res.status
      throw err
    }

    return data
  } catch (err) {
    if (err.isTimeout) {
      throw new Error('Store lookup timed out. The retailer may be slow or blocking automated checks.')
    }
    if (err.status) {
      throw err
    }
    const netErr = new Error('Smart Buy engine is unreachable. Please verify that the backend is running on port 5000.')
    netErr.isNetworkError = true
    throw netErr
  }
}

/**
 * Check Smart Buy comparison engine health status
 *
 * @returns {Promise<Object>} Health report
 */
export async function checkSmartBuyHealth() {
  const baseUrl = getSmartBuyBaseUrl()
  const endpoint = `${baseUrl}/health`

  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      timeout: 4000,
    })

    if (!res.ok) {
      return { online: false, status: `HTTP ${res.status}`, providers: [] }
    }

    const data = await res.json().catch(() => ({}))
    return {
      online: data.status === 'healthy' || res.ok,
      status: data.status || 'healthy',
      providers: data.providers || [],
      uptimeSeconds: data.uptimeSeconds || 0,
    }
  } catch (err) {
    return {
      online: false,
      status: 'offline',
      error: err.message,
      providers: [],
    }
  }
}

/**
 * Return cached sample comparison data for zero-latency demo / fallback
 */
export function getSampleSmartBuyData() {
  return SAMPLE_IPHONE_DATA
}
