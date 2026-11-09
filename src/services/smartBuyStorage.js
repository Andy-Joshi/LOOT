/**
 * Smart Buy Persistence & LOOT Integration Service
 *
 * Manages:
 * - "Saved by comparing" running savings total
 * - Last 10 comparisons history
 * - 24-hour "Sleep on it" impulse-control reminders
 * - Comparison counters and daily coin reward caps
 */

export const SMART_BUY_FIRST_COMPARISON_COINS = 5
export const SMART_BUY_REPEAT_COMPARISON_COINS = 2
export const SMART_BUY_DAILY_COMPARISON_CAP = 3

const SAVINGS_KEY = 'loot_smartbuy_total_saved'
const HISTORY_KEY = 'loot_smartbuy_history'
const REMINDERS_KEY = 'loot_smartbuy_sleep_items'
const STATS_KEY = 'loot_smartbuy_stats'

function getSafeStorage(key, defaultValue) {
  if (typeof window === 'undefined' || !window.localStorage) return defaultValue
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : defaultValue
  } catch {
    return defaultValue
  }
}

function setSafeStorage(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Get running total of savings earned by comparing
 */
export function getSmartBuySavings() {
  const val = getSafeStorage(SAVINGS_KEY, 0)
  return typeof val === 'number' && !Number.isNaN(val) ? val : 0
}

/**
 * Add savings to running total (called only when saved as goal or slept on it)
 */
export function addSmartBuySavings(amount) {
  const num = Number(amount) || 0
  if (num <= 0) return getSmartBuySavings()
  const current = getSmartBuySavings()
  const next = current + num
  setSafeStorage(SAVINGS_KEY, next)
  return next
}

/**
 * Get the last 10 comparisons
 */
export function getRecentComparisons() {
  const list = getSafeStorage(HISTORY_KEY, [])
  return Array.isArray(list) ? list : []
}

/**
 * Save a comparison to history (capped at 10 items)
 */
export function saveComparisonToHistory(entry) {
  if (!entry || !entry.item) return getRecentComparisons()
  const list = getRecentComparisons()

  const formattedDate = new Date().toLocaleDateString('en-IN', {
    month: 'short',
    day: 'numeric'
  })

  const newEntry = {
    id: entry.id || `comp_${Date.now()}`,
    item: entry.item,
    price: entry.price || 0,
    store: entry.store || 'Best Store',
    url: entry.url || '',
    savings: entry.savings || 0,
    date: entry.date || formattedDate,
    timestamp: Date.now(),
    searchData: entry.searchData || null
  }

  // Deduplicate by item name (case-insensitive)
  const filtered = list.filter(i => i.item.toLowerCase() !== newEntry.item.toLowerCase())
  const updated = [newEntry, ...filtered].slice(0, 10)
  setSafeStorage(HISTORY_KEY, updated)
  return updated
}

/**
 * Get all active/matured 24-hour sleep reminders
 */
export function getSleepReminders() {
  const list = getSafeStorage(REMINDERS_KEY, [])
  return Array.isArray(list) ? list : []
}

/**
 * Save or toggle a 24-hour sleep reminder
 */
export function saveSleepReminder(reminder) {
  const list = getSleepReminders()
  const existingIdx = list.findIndex(r => r.item === reminder.item)

  if (existingIdx >= 0) {
    // Toggle/update
    list[existingIdx] = {
      ...list[existingIdx],
      ...reminder,
      timestamp: Date.now(),
      dismissed: false
    }
  } else {
    list.unshift({
      id: `sleep_${Date.now()}`,
      item: reminder.item,
      price: reminder.price || 0,
      store: reminder.store || 'Best Store',
      url: reminder.url || '',
      highestPrice: reminder.highestPrice || reminder.price,
      savings: reminder.savings || 0,
      timestamp: Date.now(),
      dismissed: false
    })
  }

  const trimmed = list.slice(0, 10)
  setSafeStorage(REMINDERS_KEY, trimmed)
  return trimmed
}

/**
 * Dismiss a sleep reminder
 */
export function dismissSleepReminder(idOrItem) {
  const list = getSleepReminders()
  const updated = list.map(r => {
    if (r.id === idOrItem || r.item === idOrItem) {
      return { ...r, dismissed: true }
    }
    return r
  })
  setSafeStorage(REMINDERS_KEY, updated)
  return updated
}

/**
 * Get comparison tracking stats (total comparisons and daily count)
 */
export function getSmartBuyComparisonStats() {
  const today = new Date().toISOString().slice(0, 10)
  const stats = getSafeStorage(STATS_KEY, {
    totalComparisons: 0,
    lastComparisonDate: today,
    dailyCount: 0
  })

  // Reset daily count if day changed
  if (stats.lastComparisonDate !== today) {
    stats.lastComparisonDate = today
    stats.dailyCount = 0
    setSafeStorage(STATS_KEY, stats)
  }

  return stats
}

/**
 * Record a comparison and determine if coins should be awarded
 *
 * @returns {{ awardedCoins: number, totalComparisons: number, unlockedBadge: boolean }}
 */
export function recordComparisonForCoins() {
  const today = new Date().toISOString().slice(0, 10)
  const stats = getSmartBuyComparisonStats()

  const isFirstEver = stats.totalComparisons === 0
  let awardedCoins = 0

  if (stats.dailyCount < SMART_BUY_DAILY_COMPARISON_CAP) {
    awardedCoins = isFirstEver
      ? SMART_BUY_FIRST_COMPARISON_COINS
      : SMART_BUY_REPEAT_COMPARISON_COINS
    stats.dailyCount += 1
  }

  stats.totalComparisons += 1
  stats.lastComparisonDate = today
  setSafeStorage(STATS_KEY, stats)

  const unlockedBadge = stats.totalComparisons >= 3

  return {
    awardedCoins,
    totalComparisons: stats.totalComparisons,
    unlockedBadge,
    dailyCount: stats.dailyCount
  }
}
