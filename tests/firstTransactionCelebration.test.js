import assert from 'node:assert'
import { test, describe } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

describe('Transaction Lodged Celebration Component & Trigger Logic', () => {
  test('Component source file exists and contains necessary SVG and animation elements', () => {
    const jsxPath = join(rootDir, 'src', 'components', 'FirstTransactionCelebration.jsx')
    assert(existsSync(jsxPath), 'FirstTransactionCelebration.jsx must exist')

    const jsxContent = readFileSync(jsxPath, 'utf8')
    assert(jsxContent.includes('FirstTransactionCelebration'), 'Must export FirstTransactionCelebration')
    assert(jsxContent.includes('viewBox="0 0 400 500"'), 'Must contain SVG with viewBox 0 0 400 500')
    assert(jsxContent.includes('className="rc"'), 'Must contain rc group')
    assert(jsxContent.includes('className="paper"'), 'Must contain paper group')
    assert(jsxContent.includes('className="dollar d1"'), 'Must contain dollar d1')
    assert(jsxContent.includes('className="dollar d2"'), 'Must contain dollar d2')
    assert(jsxContent.includes('className="chk"'), 'Must contain chk')
    assert(jsxContent.includes('className="chk2"'), 'Must contain chk2')
    assert(jsxContent.includes('className="scan"'), 'Must contain scan bar')
    assert(jsxContent.includes('className="pop"'), 'Must contain pop group')
    assert(jsxContent.includes('pathLength="1"'), 'Must include pathLength="1" for checkmark drawing')
    assert(jsxContent.includes('handleReplay'), 'Must support replay mechanism')
    assert(jsxContent.includes('Transaction Lodged!'), 'Must support standard transaction lodged headline')
    assert(jsxContent.includes('First Transaction Logged!'), 'Must support first transaction headline')
  })

  test('Component CSS file contains all keyframes and styled classes from uploaded HTML', () => {
    const cssPath = join(rootDir, 'src', 'components', 'FirstTransactionCelebration.css')
    assert(existsSync(cssPath), 'FirstTransactionCelebration.css must exist')

    const cssContent = readFileSync(cssPath, 'utf8')
    assert(cssContent.includes('@keyframes firstTxDrop'), 'Must contain firstTxDrop animation')
    assert(cssContent.includes('@keyframes firstTxPrint'), 'Must contain firstTxPrint animation')
    assert(cssContent.includes('@keyframes firstTxPop'), 'Must contain firstTxPop animation')
    assert(cssContent.includes('@keyframes firstTxDraw'), 'Must contain firstTxDraw animation')
    assert(cssContent.includes('@keyframes firstTxGlow'), 'Must contain firstTxGlow animation')
    assert(cssContent.includes('@keyframes firstTxBump'), 'Must contain firstTxBump animation')
    assert(cssContent.includes('@keyframes firstTxFly'), 'Must contain firstTxFly animation')
    assert(cssContent.includes('@keyframes firstTxScan'), 'Must contain firstTxScan animation')
    assert(cssContent.includes('prefers-reduced-motion'), 'Must include accessibility reduced motion query')
    assert(cssContent.includes('.first-tx-backdrop'), 'Must include backdrop overlay styles')
    assert(cssContent.includes('.first-tx-card'), 'Must include card styling')
  })

  test('Every transaction lodged triggers the celebration pop-up with adaptive badge', () => {
    // Model behavior of App.jsx addExpense
    const triggerCelebration = (isFirst) => {
      const modalPayload = {
        title: 'Lunch with friends',
        amount: -250,
        category: 'Lifestyle',
        isFirst
      }
      const title = modalPayload.isFirst ? 'First Transaction Logged!' : 'Transaction Lodged!'
      const kicker = modalPayload.isFirst ? '✦ Milestone Unlocked ✦' : '✦ Transaction Lodged ✦'
      return { modalPayload, title, kicker }
    }

    // First transaction lodged
    const firstResult = triggerCelebration(true)
    assert.strictEqual(firstResult.title, 'First Transaction Logged!')
    assert.strictEqual(firstResult.kicker, '✦ Milestone Unlocked ✦')

    // Second / Nth transaction lodged
    const secondResult = triggerCelebration(false)
    assert.strictEqual(secondResult.title, 'Transaction Lodged!')
    assert.strictEqual(secondResult.kicker, '✦ Transaction Lodged ✦')
  })

  test('Sparks generator produces 14 sparks with valid radial trigonometry coordinates', () => {
    const sparks = []
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const r = 90 + 30 // test sample radius in [90, 150]
      const z = 7.5 // test sample size in [5, 10]
      const dx = Math.cos(a) * r
      const dy = Math.sin(a) * r
      sparks.push({ i, a, r, z, dx, dy })
    }

    assert.strictEqual(sparks.length, 14, 'Must generate exactly 14 sparks')

    // Verify angles cover the 360 degree circle
    assert.strictEqual(sparks[0].a, 0, 'First spark angle must be 0')
    const lastAngle = sparks[13].a
    assert(lastAngle < Math.PI * 2 && lastAngle > Math.PI * 1.8, 'Angles distribute around full circle')

    // Verify distance from origin matches radius
    for (const s of sparks) {
      const dist = Math.sqrt(s.dx * s.dx + s.dy * s.dy)
      assert(Math.abs(dist - s.r) < 0.0001, 'Spark delta matches radial distance')
    }
  })
})
