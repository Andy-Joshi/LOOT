import assert from 'node:assert'
import { test, describe } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

describe('Money Lab Layout, Empty States, and Responsive Architecture', () => {
  test('MoneyLabEmptyState is a single card with clean copy, centered icon and ONE primary button', () => {
    const filePath = join(rootDir, 'src', 'components', 'MoneyLabEmptyState.jsx')
    assert(existsSync(filePath), 'MoneyLabEmptyState.jsx must exist')

    const content = readFileSync(filePath, 'utf8')
    assert(content.includes('className="lab-empty-card card"'), 'Must render single card with no nested card classes')
    assert(!content.includes('empty-state-card card'), 'Must not have nested card border')
    assert(content.includes('No transactions lodged yet'), 'Must display title')
    assert(content.includes('Log your first spend to earn +2 coins.'), 'Must have concise copy without celebration prompt')
    assert(!content.includes('and trigger the celebration animation!'), 'Must remove celebration prompt from copy')
    assert(content.includes('＋ Log your first spend (+2 ✦)'), 'Must have primary action button')
    assert(content.includes('showDevArt = isDebugMode()'), 'Developer preview art must only show in debug mode')
  })

  test('SplitBillsEmptyState exists and mirrors MoneyLabEmptyState structure and dimensions', () => {
    const filePath = join(rootDir, 'src', 'components', 'SplitBillsEmptyState.jsx')
    assert(existsSync(filePath), 'SplitBillsEmptyState.jsx must exist')

    const content = readFileSync(filePath, 'utf8')
    assert(content.includes('export default function SplitBillsEmptyState'), 'Must export SplitBillsEmptyState')
    assert(content.includes('className="lab-empty-card card"'), 'Must use identical lab-empty-card class to match height')
    assert(content.includes('No shared expenses yet'), 'Must have required empty state title')
    assert(content.includes('Create a split bill to share costs and earn +5 coins.'), 'Must have single short line of text')
    assert(content.includes('＋ Create your first split (+5 ✦)'), 'Must have primary create split action button')
    assert(content.includes('<svg'), 'Must render SVG icon artwork')
  })

  test('App.jsx has aligned two-column headers, wraps actions cleanly, and hides dev art buttons', () => {
    const filePath = join(rootDir, 'src', 'App.jsx')
    const content = readFileSync(filePath, 'utf8')

    // Expenses Header
    assert(content.includes('className="lab-head-info"'), 'Must separate title into lab-head-info')
    assert(content.includes('<span className="section-kicker">EXPENSES</span>'), 'Must display EXPENSES kicker')
    assert(content.includes('<h2>Money moves</h2>'), 'Must have Money moves title')
    assert(content.includes('isDebugMode() && onPreviewFirstTxCelebration'), 'Transaction Art button must be hidden in normal UI')

    // Split Bills Header
    assert(content.includes('<span className="section-kicker">SPLIT BILLS</span>'), 'Must display SPLIT BILLS kicker')
    assert(content.includes('<h2>Settle together</h2>'), 'Must have Settle together title')
    assert(content.includes('SplitBillsEmptyState'), 'Must use SplitBillsEmptyState when no splits exist')

    // Habit Challenges Grid
    assert(content.includes('className="challenges-grid"'), 'Must use dedicated challenges-grid')
    assert(content.includes('className="challenge-top"'), 'Must have top bar for icon and reward badge')
    assert(content.includes('className="challenge-footer"'), 'Must have footer row')
    assert(content.includes('className="challenge-progress-text"'), 'Must place progress text in footer')
    assert(content.includes('className="challenge-action-wrap"'), 'Must place action button in footer')
  })

  test('App.css defines 2-column grid, equal heights, 2-column challenges, and mobile responsiveness', () => {
    const cssPath = join(rootDir, 'src', 'App.css')
    const cssContent = readFileSync(cssPath, 'utf8')

    // Money Lab Grid
    assert(cssContent.includes('.money-lab-grid {'), 'Must define .money-lab-grid')
    assert(cssContent.includes('repeat(2, minmax(0, 1fr))'), 'Must use 2 equal columns on desktop')
    assert(cssContent.includes('.lab-empty-card {'), 'Must define .lab-empty-card')
    assert(cssContent.includes('min-height: 420px;'), 'Must define equal min-height for empty cards')

    // Challenges Grid
    assert(cssContent.includes('.challenges-grid {'), 'Must define .challenges-grid')
    assert(cssContent.includes('.challenge-footer {'), 'Must define .challenge-footer flex space-between')

    // Breakpoints
    assert(cssContent.includes('@media (max-width: 900px)'), 'Must have 900px breakpoint')
    assert(cssContent.includes('@media (max-width: 560px)'), 'Must have mobile breakpoint')
    assert(cssContent.includes('min-height: 44px;'), 'Must have 44px touch targets on mobile')
  })

  test('debug utility correctly parses query parameters and hash flags', () => {
    const debugPath = join(rootDir, 'src', 'utils', 'debug.js')
    assert(existsSync(debugPath), 'src/utils/debug.js must exist')

    const content = readFileSync(debugPath, 'utf8')
    assert(content.includes('export function isDebugMode'), 'Must export isDebugMode function')
    assert(content.includes("params.get('debug') === '1'"), 'Must check for ?debug=1')
    assert(content.includes("window.location.hash.includes('debug')"), 'Must check for hash debug')
  })
})
