import assert from 'node:assert'
import { test, describe, beforeEach } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Mock browser localStorage for node test environment
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
globalThis.window = {
  localStorage: mockLocalStorage,
  location: { origin: 'http://localhost:5173' }
}

import {
  saveComparisonToHistory,
  getRecentComparisons,
  recordComparisonForCoins,
  getSmartBuySavings,
  addSmartBuySavings
} from '../src/services/smartBuyStorage.js'

import {
  isProductUrl,
  getSampleSmartBuyData
} from '../src/services/smartBuyApi.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

describe('LOOT Smart Buy UI Refinement & Regression Suite', () => {
  beforeEach(() => {
    mockLocalStorage.clear()
  })

  // ========================================================
  // 1 & 2: PRODUCT URL VS PRODUCT NAME SEARCH FUNCTIONALITY
  // ========================================================
  test('Verification 1 & 2: Product URL and product-name searches correctly identified', () => {
    // E-commerce URLs should evaluate to true
    assert.strictEqual(isProductUrl('https://www.amazon.in/dp/B0CX234'), true)
    assert.strictEqual(isProductUrl('https://www.flipkart.com/apple-iphone-17-pro/p/itm12345'), true)
    assert.strictEqual(isProductUrl('https://www.croma.com/sony-headphones/p/270320'), true)
    assert.strictEqual(isProductUrl('https://www.reliancedigital.in/boat-airdopes/p/491901'), true)
    assert.strictEqual(isProductUrl('https://www.vijaysales.com/macbook-air-m3/21990'), true)

    // Freeform product names should evaluate to false
    assert.strictEqual(isProductUrl('iPhone 17 Pro 256GB'), false)
    assert.strictEqual(isProductUrl('Sony WH-CH720N Noise Canceling'), false)
    assert.strictEqual(isProductUrl('boAt Airdopes 141'), false)
    assert.strictEqual(isProductUrl('MacBook Air M3 16GB'), false)
    assert.strictEqual(isProductUrl('ASUS Vivobook 15 (2026)'), false)
  })

  // ========================================================
  // 3: ALL FIVE RETAILERS REPRESENTED
  // ========================================================
  test('Verification 3: All five target retailers are represented in SmartBuy components', () => {
    const loadingFile = readFileSync(join(rootDir, 'src/components/smartbuy/SmartBuyLoadingState.jsx'), 'utf8')
    const viewFile = readFileSync(join(rootDir, 'src/components/smartbuy/SmartBuyView.jsx'), 'utf8')

    const requiredRetailers = [
      'Amazon',
      'Flipkart',
      'Croma',
      'Reliance Digital',
      'Vijay Sales'
    ]

    for (const retailer of requiredRetailers) {
      assert.ok(
        loadingFile.includes(retailer),
        `SmartBuyLoadingState must represent retailer: ${retailer}`
      )
      assert.ok(
        viewFile.includes(retailer),
        `SmartBuyView must represent verified retailer: ${retailer}`
      )
    }
  })

  // ========================================================
  // 4 & 5: LOADING STATES AND RETAILER STATE TRANSITIONS
  // ========================================================
  test('Verification 4 & 5: Loading state supports waiting, searching, completed, unavailable, and failed states without raw URL repetition', () => {
    const loadingFile = readFileSync(join(rootDir, 'src/components/smartbuy/SmartBuyLoadingState.jsx'), 'utf8')

    // Must define all 5 states
    assert.ok(loadingFile.includes('completed'), 'Must support completed state')
    assert.ok(loadingFile.includes('searching'), 'Must support searching state')
    assert.ok(loadingFile.includes('waiting'), 'Must support waiting state')
    assert.ok(loadingFile.includes('unavailable'), 'Must support unavailable state')
    assert.ok(loadingFile.includes('failed'), 'Must support failed state')

    // Required headings
    assert.ok(loadingFile.includes('Comparing store prices...'), 'Must render exact heading')
    assert.ok(loadingFile.includes('Checking verified retailers for the best deal.'), 'Must render exact subheading')

    // Must NOT display raw url string
    assert.ok(!loadingFile.includes('"{queryOrUrl}"'), 'Must NOT display raw query or URL in scanning text')
    assert.ok(!loadingFile.includes('Scanning live retailers across India for'), 'Old oversized label must be removed')
  })

  // ========================================================
  // 6: SUCCESSFUL COMPARISON RESULTS ACCURACY
  // ========================================================
  test('Verification 6: Successful comparison results display accurate prices, best offer, and savings', () => {
    const sample = getSampleSmartBuyData()
    assert.ok(sample.comparison, 'Comparison object must exist')
    assert.ok(sample.comparison.lowestOffer, 'Lowest offer must exist')
    assert.strictEqual(sample.comparison.lowestOffer.price, 119900, 'Lowest price must match verified deal')
    assert.strictEqual(sample.comparison.lowestOffer.retailer, 'Croma', 'Best retailer must match Croma')
    assert.strictEqual(sample.comparison.potentialSavings, 10000, 'Potential savings must accurately calculate ₹10,000')

    const compared = sample.comparison.comparedOffers
    assert.ok(compared.length >= 3, 'Must compare across multiple verified stores')
    for (const offer of compared) {
      assert.ok(offer.price > 0, `Offer for ${offer.retailer} must have a positive price`)
      assert.ok(offer.retailer, 'Offer must have retailer name')
    }
  })

  // ========================================================
  // 7, 8 & 9: RECENT COMPARISONS: PRODUCT NAMES ONLY, NO ₹0
  // ========================================================
  test('Verification 7, 8 & 9: Recent comparisons persist after reload and render product names ONLY (no ₹0, no price metadata)', () => {
    // 1. Simulate saving multiple comparisons with different prices (including ₹0 edge cases)
    saveComparisonToHistory({
      item: 'Apple iPhone 17 Pro 256GB',
      price: 129900,
      store: 'Croma',
      savings: 5000
    })

    saveComparisonToHistory({
      item: 'ASUS Vivobook 15 (2026)',
      price: 0, // ₹0 incomplete price edge case
      store: 'Reliance Digital',
      savings: 0
    })

    saveComparisonToHistory({
      item: 'MacBook Air M3',
      price: 99900,
      store: 'Amazon India',
      savings: 15000
    })

    saveComparisonToHistory({
      item: 'OnePlus Nord 6',
      price: 32999,
      store: 'Flipkart',
      savings: 2000
    })

    // 2. Retrieve history (survives refresh / storage read)
    const history = getRecentComparisons()
    assert.strictEqual(history.length, 4)
    assert.strictEqual(history[0].item, 'OnePlus Nord 6')
    assert.strictEqual(history[1].item, 'MacBook Air M3')
    assert.strictEqual(history[2].item, 'ASUS Vivobook 15 (2026)')
    assert.strictEqual(history[3].item, 'Apple iPhone 17 Pro 256GB')

    // 3. Inspect SmartBuyView.jsx code to verify:
    // Recent comparisons section must render ONLY the product name, and NO price, NO ₹0, NO store name, NO savings
    const viewFile = readFileSync(join(rootDir, 'src/components/smartbuy/SmartBuyView.jsx'), 'utf8')
    assert.ok(viewFile.includes('smartbuy-history-card'), 'Recent comparisons history card must exist in SmartBuyView')

    const historySectionStart = viewFile.indexOf('smartbuy-history-card')
    const historySectionEnd = viewFile.indexOf('</section>', historySectionStart)
    const historySectionHtml = viewFile.slice(historySectionStart, historySectionEnd)

    // Verify it renders product name
    assert.ok(historySectionHtml.includes('{productName}'), 'History tile must render product name')

    // Verify it does NOT render price
    assert.ok(!historySectionHtml.includes('history-price'), 'history-price class must NOT exist in history section')
    assert.ok(!historySectionHtml.includes('₹'), 'Currency symbol ₹ must NOT be rendered in history section')
    assert.ok(!historySectionHtml.includes('item.price'), 'item.price must NOT be rendered in history tiles')
    assert.ok(!historySectionHtml.includes('item.savings'), 'item.savings must NOT be rendered in history tiles')
    assert.ok(!historySectionHtml.includes('item.store'), 'item.store must NOT be rendered in history tiles')
    assert.ok(!historySectionHtml.includes('item.date'), 'item.date must NOT be rendered in history tiles')
  })

  // ========================================================
  // 10: LOOT COIN REWARDS AND GAMIFICATION
  // ========================================================
  test('Verification 10: Existing LOOT coin rewards, running savings, and daily comparison cap remain fully operational', () => {
    // 1. Initial balance baseline
    assert.strictEqual(getSmartBuySavings(), 0)

    // 2. Add savings from a completed deal
    const s1 = addSmartBuySavings(3500)
    assert.strictEqual(s1, 3500)
    assert.strictEqual(getSmartBuySavings(), 3500)

    // 3. Coin rewards progression
    // Comparison 1 (First ever): 5 coins
    const c1 = recordComparisonForCoins()
    assert.strictEqual(c1.awardedCoins, 5, 'First comparison must award 5 coins')
    assert.strictEqual(c1.totalComparisons, 1)

    // Comparison 2 (Repeat): 2 coins
    const c2 = recordComparisonForCoins()
    assert.strictEqual(c2.awardedCoins, 2, 'Second comparison must award 2 coins')

    // Comparison 3 (Repeat): 2 coins + badge unlock
    const c3 = recordComparisonForCoins()
    assert.strictEqual(c3.awardedCoins, 2, 'Third comparison must award 2 coins')
    assert.strictEqual(c3.unlockedBadge, true, 'Third comparison must unlock Smart Shopper achievement badge')

    // Comparison 4 (Cap reached on same day): 0 coins
    const c4 = recordComparisonForCoins()
    assert.strictEqual(c4.awardedCoins, 0, 'Fourth comparison on same day must be capped at 0 coins')
  })
})
