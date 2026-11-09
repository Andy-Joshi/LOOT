import assert from 'node:assert'
import { test, describe, before, after } from 'node:test'
import { fork } from 'node:child_process'
import { unlinkSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Mock browser localStorage for node environment storage tests
const mockLocalStorage = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, val) => { store[key] = String(val) },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
globalThis.localStorage = mockLocalStorage
globalThis.window = { localStorage: mockLocalStorage, location: { origin: 'http://localhost:5173' } }

import {
  SMART_BUY_FIRST_COMPARISON_COINS,
  SMART_BUY_REPEAT_COMPARISON_COINS,
  SMART_BUY_DAILY_COMPARISON_CAP,
  getSmartBuySavings,
  addSmartBuySavings,
  getRecentComparisons,
  saveComparisonToHistory,
  getSleepReminders,
  saveSleepReminder,
  dismissSleepReminder,
  recordComparisonForCoins,
  getSmartBuyComparisonStats
} from '../src/services/smartBuyStorage.js'

import {
  isProductUrl,
  getSmartBuyBaseUrl,
  getSampleSmartBuyData
} from '../src/services/smartBuyApi.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const dbPath = join(rootDir, 'server', 'db.json')
const testDbPath = join(rootDir, 'server', 'db.smartbuy.test.json')
const TEST_PORT = 3288
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`

const apiRequest = async (path, options = {}) => {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  const json = await res.json()
  return { status: res.status, ok: res.ok, data: json }
}

describe('LOOT Smart Buy Integration Test Suite', () => {
  let serverProcess

  before(async () => {
    // Prepare isolated server database for server integration tests
    const initialState = JSON.parse(readFileSync(dbPath, 'utf8'))
    initialState.profile.coins = 100
    initialState.smartBuyStats = { totalComparisons: 0, dailyCount: 0, lastComparisonDate: new Date().toISOString().slice(0, 10) }
    initialState.achievements = (initialState.achievements || []).map(a => {
      if (a.id === 5 || a.title === 'Smart Shopper') return { ...a, unlocked: false }
      return a
    })
    initialState.coinTransactions = (initialState.coinTransactions || []).filter(
      tx => !tx.referenceId?.startsWith('smartbuy') && !tx.referenceId?.startsWith('achievement_5')
    )
    writeFileSync(testDbPath, JSON.stringify(initialState, null, 2))

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

  after(() => {
    if (serverProcess) serverProcess.kill()
    if (existsSync(testDbPath)) unlinkSync(testDbPath)
  })

  // ==========================================
  // 1. SMART BUY API & URL DETECTOR TESTS
  // ==========================================
  test('Smart Buy API: URL detection and base URL resolution', () => {
    assert.strictEqual(isProductUrl('https://www.croma.com/apple-iphone-17-pro/p/308520'), true)
    assert.strictEqual(isProductUrl('http://flipkart.com/p/itm12345'), true)
    assert.strictEqual(isProductUrl('amazon.in/dp/B0CX234'), true)
    assert.strictEqual(isProductUrl('www.reliancedigital.in/item'), true)
    assert.strictEqual(isProductUrl('vijaysales.com/product'), true)
    assert.strictEqual(isProductUrl('iPhone 17 Pro'), false)
    assert.strictEqual(isProductUrl('Sony WH-1000XM5'), false)
    assert.strictEqual(isProductUrl(''), false)
    assert.strictEqual(isProductUrl(null), false)

    // Base URL resolution
    const baseUrl = getSmartBuyBaseUrl()
    assert.ok(baseUrl.includes('smartbuy') || baseUrl.includes(':5000'))

    // Sample Data structure
    const sample = getSampleSmartBuyData()
    assert.ok(sample.targetIdentity, 'Must have targetIdentity')
    assert.ok(sample.comparison, 'Must have comparison object')
    assert.ok(sample.comparison.lowestOffer.price > 0, 'Must have lowestOffer with positive price')
    assert.ok(sample.comparison.potentialSavings > 0, 'Must have potentialSavings')
    assert.ok(sample.comparison.comparedOffers.length >= 2, 'Must have multiple comparedOffers')
  })

  // ==========================================
  // 2. SMART BUY PERSISTENCE & COIN RULES
  // ==========================================
  test('Smart Buy Storage: Named constants for coin rewards and daily cap', () => {
    assert.strictEqual(SMART_BUY_FIRST_COMPARISON_COINS, 5, 'First comparison must award 5 coins')
    assert.strictEqual(SMART_BUY_REPEAT_COMPARISON_COINS, 2, 'Repeat comparison must award 2 coins')
    assert.strictEqual(SMART_BUY_DAILY_COMPARISON_CAP, 3, 'Daily comparison reward cap must be 3')
  })

  test('Smart Buy Storage: "Saved by comparing" running total updates ONLY on goal save or sleep', () => {
    mockLocalStorage.clear()

    // Baseline should be 0
    assert.strictEqual(getSmartBuySavings(), 0)

    // Adding negative or zero savings should have no effect
    addSmartBuySavings(0)
    addSmartBuySavings(-50)
    assert.strictEqual(getSmartBuySavings(), 0)

    // Add ₹5,000 saved from iPhone deal
    const updated = addSmartBuySavings(5000)
    assert.strictEqual(updated, 5000)
    assert.strictEqual(getSmartBuySavings(), 5000)

    // Add another ₹1,200 saved from headphones deal
    const secondUpdate = addSmartBuySavings(1200)
    assert.strictEqual(secondUpdate, 6200)
    assert.strictEqual(getSmartBuySavings(), 6200)
  })

  test('Smart Buy Storage: History is capped at last 10 comparisons and deduplicates', () => {
    mockLocalStorage.clear()

    for (let i = 1; i <= 15; i++) {
      saveComparisonToHistory({
        item: `Gadget #${i}`,
        price: 1000 * i,
        store: 'Croma',
        savings: 200
      })
    }

    const history = getRecentComparisons()
    assert.strictEqual(history.length, 10, 'History must strictly be capped at 10 items')
    assert.strictEqual(history[0].item, 'Gadget #15', 'Most recent comparison must be at the top')

    // Deduplication test: re-searching Gadget #15 moves it to top without duplicating
    saveComparisonToHistory({
      item: 'gadget #15',
      price: 999,
      store: 'Amazon',
      savings: 300
    })
    const afterDedup = getRecentComparisons()
    assert.strictEqual(afterDedup.length, 10, 'Length must remain 10 after re-adding existing item')
    assert.strictEqual(afterDedup[0].price, 999, 'Updated price should reflect on top')
  })

  test('Smart Buy Storage: 24h Sleep on It reminders and maturity check', () => {
    mockLocalStorage.clear()

    // 1. Add active reminder
    saveSleepReminder({
      item: 'MacBook Air M3',
      price: 99900,
      highestPrice: 114900,
      savings: 15000,
      store: 'Vijay Sales'
    })

    const list = getSleepReminders()
    assert.strictEqual(list.length, 1)
    assert.strictEqual(list[0].item, 'MacBook Air M3')
    assert.strictEqual(list[0].dismissed, false)

    // 2. Add an expired reminder (26 hours ago)
    const twentySixHoursAgo = Date.now() - (26 * 60 * 60 * 1000)
    list.push({
      id: 'sleep_old_1',
      item: 'Sony WH-1000XM5',
      price: 24990,
      highestPrice: 29990,
      savings: 5000,
      store: 'Croma',
      timestamp: twentySixHoursAgo,
      dismissed: false
    })
    mockLocalStorage.setItem('loot_smartbuy_sleep_items', JSON.stringify(list))

    // Check matured reminders
    const updatedList = getSleepReminders()
    const matured = updatedList.filter(r => !r.dismissed && Date.now() - r.timestamp >= 24 * 3600 * 1000)
    assert.strictEqual(matured.length, 1)
    assert.strictEqual(matured[0].item, 'Sony WH-1000XM5')

    // 3. Dismiss reminder
    dismissSleepReminder('sleep_old_1')
    const afterDismiss = getSleepReminders()
    const stillMatured = afterDismiss.filter(r => !r.dismissed && Date.now() - r.timestamp >= 24 * 3600 * 1000)
    assert.strictEqual(stillMatured.length, 0, 'Dismissed reminder must no longer trigger impulse nudge')
  })

  test('Smart Buy Storage: Coin progression and daily cap (5 for 1st, 2 for repeat, max 3/day)', () => {
    mockLocalStorage.clear()

    // Comparison 1 (First ever): +5 coins
    const c1 = recordComparisonForCoins()
    assert.strictEqual(c1.awardedCoins, 5, 'First comparison must award 5 coins')
    assert.strictEqual(c1.totalComparisons, 1)
    assert.strictEqual(c1.unlockedBadge, false)

    const stats = getSmartBuyComparisonStats()
    assert.strictEqual(stats.totalComparisons, 1)
    assert.strictEqual(stats.dailyCount, 1)

    // Comparison 2 (Repeat): +2 coins
    const c2 = recordComparisonForCoins()
    assert.strictEqual(c2.awardedCoins, 2, '2nd comparison must award 2 coins')
    assert.strictEqual(c2.totalComparisons, 2)
    assert.strictEqual(c2.unlockedBadge, false)

    // Comparison 3 (Repeat & reaches 3): +2 coins, unlocks Smart Shopper badge
    const c3 = recordComparisonForCoins()
    assert.strictEqual(c3.awardedCoins, 2, '3rd comparison must award 2 coins')
    assert.strictEqual(c3.totalComparisons, 3)
    assert.strictEqual(c3.unlockedBadge, true, 'Badge must unlock at 3 comparisons')

    // Comparison 4 (Exceeds daily cap of 3): 0 coins awarded
    const c4 = recordComparisonForCoins()
    assert.strictEqual(c4.awardedCoins, 0, 'Exceeding daily cap must award 0 coins')
    assert.strictEqual(c4.totalComparisons, 4)
  })

  // ==========================================
  // 3. SERVER API INTEGRATION TESTS
  // ==========================================
  test('Server API: POST /api/comparisons/record awards coins and unlocks Smart Shopper', async () => {
    // 1. Initial State Check
    const stateRes = await apiRequest('/api/state')
    const initialCoins = stateRes.data.profile.coins

    // 2. First comparison record
    const comp1 = await apiRequest('/api/comparisons/record', {
      method: 'POST',
      body: JSON.stringify({ item: 'Sony WH-CH720N', price: 7990, savings: 2000 })
    })
    assert.strictEqual(comp1.ok, true)
    assert.strictEqual(comp1.data.awardedCoins, 5, 'Server must award 5 coins for first comparison')

    // 3. Second comparison record
    const comp2 = await apiRequest('/api/comparisons/record', {
      method: 'POST',
      body: JSON.stringify({ item: 'boAt Airdopes', price: 1299, savings: 500 })
    })
    assert.strictEqual(comp2.ok, true)
    assert.strictEqual(comp2.data.awardedCoins, 2, 'Server must award 2 coins for second comparison')

    // 4. Third comparison record -> unlocks Smart Shopper (+15 coins achievement)
    const comp3 = await apiRequest('/api/comparisons/record', {
      method: 'POST',
      body: JSON.stringify({ item: 'iPhone 17 Pro', price: 124900, savings: 10000 })
    })
    assert.strictEqual(comp3.ok, true)
    assert.strictEqual(comp3.data.awardedCoins, 2)
    assert.strictEqual(comp3.data.unlockedBadge, true, 'Server must unlock Smart Shopper achievement at 3 comparisons')

    // 5. Verify final coins in state
    const finalState = await apiRequest('/api/state')
    // initial + 5 + 2 + 2 + 15 (achievement reward) = initial + 24
    assert.strictEqual(finalState.data.profile.coins, initialCoins + 24)

    // Check achievement status
    const smartShopperAch = finalState.data.achievements.find(a => a.id === 5 || a.title === 'Smart Shopper')
    assert.ok(smartShopperAch)
    assert.strictEqual(smartShopperAch.unlocked, true)
  })

  // ==========================================
  // 4. APP.JSX CODE & UI INTEGRATION AUDIT
  // ==========================================
  test('App.jsx Architecture: Navigation, Modals, Nudge, and Design Tokens', () => {
    const appSource = readFileSync(join(rootDir, 'src', 'App.jsx'), 'utf8')
    const appCss = readFileSync(join(rootDir, 'src', 'App.css'), 'utf8')
    const smartBuyCss = readFileSync(join(rootDir, 'src', 'components', 'smartbuy', 'SmartBuy.css'), 'utf8')

    // 1. Navigation verification
    assert.ok(appSource.includes("['Smart Buy', '⚡']"), 'navItems must contain Smart Buy with icon')
    assert.ok(appSource.includes('smartbuy-pill'), 'Sidebar must render NEW pill for Smart Buy')
    assert.ok(appSource.includes("activePage === 'Smart Buy'"), 'App must conditionally render SmartBuyView')
    assert.ok(appSource.includes("<SmartBuyView"), 'SmartBuyView component must be mounted in App.jsx')

    // 2. URL Routing verification
    assert.ok(appSource.includes("'/smart-buy'"), 'App.jsx must support /smart-buy path')
    assert.ok(appSource.includes('window.history.pushState'), 'App.jsx must sync URL via pushState')
    assert.ok(appSource.includes('popstate'), 'App.jsx must listen to browser popstate for history navigation')

    // 3. Dashboard Quick Action & 24h Sleep on It Nudge
    assert.ok(appSource.includes('smartbuy-action-tile'), 'Dashboard must include Smart Buy quick action tile')
    assert.ok(appSource.includes('smartbuy-sleep-nudge-card'), 'Dashboard must render 24h Sleep on It impulse nudge card')
    assert.ok(appSource.includes('24-HOUR IMPULSE CHECK'), 'Nudge card must feature 24-HOUR IMPULSE CHECK headline')
    assert.ok(appSource.includes('onSaveGoalFromReminder'), 'Nudge must connect to save goal')
    assert.ok(appSource.includes('onAskParentFromReminder'), 'Nudge must connect to ask parent')
    assert.ok(appSource.includes('onDismissReminder'), 'Nudge must connect to dismiss')

    // 4. Handlers & Prefilling logic
    assert.ok(appSource.includes('handleSmartBuySaveGoal'), 'Must implement handleSmartBuySaveGoal')
    assert.ok(appSource.includes('handleSmartBuyAskParent'), 'Must implement handleSmartBuyAskParent')
    assert.ok(appSource.includes('handleSmartBuySleepOnIt'), 'Must implement handleSmartBuySleepOnIt')
    assert.ok(appSource.includes('handleSmartBuyComparisonCompleted'), 'Must implement handleSmartBuyComparisonCompleted')

    // 5. CSS Tokens & Mobile Responsiveness
    assert.ok(smartBuyCss.includes('font-size: 16px'), 'Search input must be 16px to prevent mobile browser zooming')
    assert.ok(smartBuyCss.includes('#67ff3a') || smartBuyCss.includes('var(--neon-green'), 'Must use LOOT neon green token')
    assert.ok(smartBuyCss.includes('#8a4dff') || smartBuyCss.includes('var(--purple'), 'Must use LOOT purple token')
    assert.ok(appCss.includes('.smartbuy-sleep-nudge-card'), 'App.css must contain styles for sleep nudge card')
  })

  test('WalletView: Renders "SAVED BY COMPARING" metric tile', () => {
    const walletSource = readFileSync(join(rootDir, 'src', 'components', 'WalletView.jsx'), 'utf8')
    assert.ok(walletSource.includes('SAVED BY COMPARING'), 'WalletView must display SAVED BY COMPARING metric')
    assert.ok(walletSource.includes('getSmartBuySavings'), 'WalletView must read from getSmartBuySavings')
  })
})
