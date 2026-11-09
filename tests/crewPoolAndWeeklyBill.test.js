import { test, describe } from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'

describe('Crew Pool Created Celebration & Weekly Bill Daily Ledger Suite', () => {
  const rootDir = process.cwd()

  test('CrewPoolCelebration component exists and contains all required SVG elements', () => {
    const compPath = path.join(rootDir, 'src', 'components', 'CrewPoolCelebration.jsx')
    assert.ok(fs.existsSync(compPath), 'CrewPoolCelebration.jsx must exist')

    const source = fs.readFileSync(compPath, 'utf8')
    assert.ok(source.includes('cpc-stage'), 'Stage element must be present')
    assert.ok(source.includes('cpc-ringBase'), 'Orbital ring paths must be present')
    assert.ok(source.includes('cpc-pole'), 'Flagpole must be present')
    assert.ok(source.includes('cpc-cloth'), 'Animated flag cloth must be present')
    assert.ok(source.includes('cpc-p1') && source.includes('cpc-p2') && source.includes('cpc-p3'), '3 crew members must be present')
    assert.ok(source.includes('cpc-scal'), 'Scalloped badge must be present')
    assert.ok(source.includes('cpc-chk'), 'Checkmark must be present')
    assert.ok(source.includes('cpc-shock'), 'Shockwave circles must be present')
    assert.ok(source.includes('cpc-title'), 'Animated Crew Pool Created title must be present')
    assert.ok(source.includes('cpc-sub'), 'Crew subtitle must be present')
    assert.ok(source.includes('Replay'), 'Replay blast action must exist')
    assert.ok(source.includes('+10 LOOT Coins Added'), 'Coins reward badge must exist')
  })

  test('CrewPoolCelebration.css contains all exact keyframes and reduced motion rules', () => {
    const cssPath = path.join(rootDir, 'src', 'components', 'CrewPoolCelebration.css')
    assert.ok(fs.existsSync(cssPath), 'CrewPoolCelebration.css must exist')

    const css = fs.readFileSync(cssPath, 'utf8')
    const keyframes = [
      'cpcGIn', 'cpcGP', 'cpcDraw', 'cpcRp', 'cpcHlT', 'cpcHlB',
      'cpcPopP', 'cpcBob', 'cpcPoleUp', 'cpcUnfurl', 'cpcWave',
      'cpcStamp', 'cpcBPulse', 'cpcSpin', 'cpcChk', 'cpcShock',
      'cpcCfFly', 'cpcSpIn', 'cpcTIn', 'cpcSIn'
    ]

    for (const kf of keyframes) {
      assert.ok(css.includes(`@keyframes ${kf}`), `Missing keyframe ${kf}`)
    }
    assert.ok(css.includes('prefers-reduced-motion: reduce'), 'Must include reduced motion override')
  })

  test('WeeklyBillModal includes daily transactions of the week with TODAY indicator', () => {
    const modalPath = path.join(rootDir, 'src', 'components', 'WeeklyBillModal.jsx')
    const modalCssPath = path.join(rootDir, 'src', 'components', 'WeeklyBillModal.css')
    assert.ok(fs.existsSync(modalPath), 'WeeklyBillModal.jsx must exist')
    assert.ok(fs.existsSync(modalCssPath), 'WeeklyBillModal.css must exist')

    const source = fs.readFileSync(modalPath, 'utf8')
    assert.ok(source.includes('dailyGroups'), 'Must group transactions by day')
    assert.ok(source.includes('wbm-day-badge today'), 'Must render TODAY badge for today transactions')
    assert.ok(source.includes('wbm-daily-section'), 'Must render daily transactions section')
    assert.ok(source.includes('wbm-tx-today-tag'), 'Must display Today tag on todays items')
    assert.ok(source.includes('wbm-tx-amount'), 'Must render formatted amount')

    const css = fs.readFileSync(modalCssPath, 'utf8')
    assert.ok(css.includes('.wbm-daily-section'), 'CSS must style daily section')
    assert.ok(css.includes('.wbm-day-badge.today'), 'CSS must highlight today badge')
    assert.ok(css.includes('max-height: 90vh !important'), 'Modal must support comfortable scrolling')
  })

  test('App.jsx dynamically computes weeklyBill including today without past date cutoff', () => {
    const appPath = path.join(rootDir, 'src', 'App.jsx')
    const appSource = fs.readFileSync(appPath, 'utf8')

    assert.ok(!appSource.includes("const now = new Date('2026-11-06T23:59:59')"), 'Must NOT hardcode past cutoff date 2026-11-06')
    assert.ok(appSource.includes('allTransactions'), 'Must combine server and IndexedDB transactions')
    assert.ok(appSource.includes('weekStart'), 'Must calculate dynamic weekStart')
    assert.ok(appSource.includes('refDate'), 'Must track dynamic refDate including today')
  })

  test('Loot Hub coin-orbit element has animated orbital rings, particles, and floating badge', () => {
    const appPath = path.join(rootDir, 'src', 'App.jsx')
    const cssPath = path.join(rootDir, 'src', 'App.css')
    const appSource = fs.readFileSync(appPath, 'utf8')
    const css = fs.readFileSync(cssPath, 'utf8')

    assert.ok(appSource.includes('orbit-ambient-glow'), 'App.jsx must render ambient glow')
    assert.ok(appSource.includes('orbit-particle particle-one'), 'App.jsx must render orbital particle 1')
    assert.ok(appSource.includes('orbit-particle particle-two'), 'App.jsx must render orbital particle 2')
    assert.ok(appSource.includes('orbit-sparkles'), 'App.jsx must render sparkle stars')
    assert.ok(appSource.includes('orbit-coin-gleam'), 'App.jsx must render gleam streak')

    assert.ok(css.includes('orbitSpinOne'), 'CSS must define 3D orbital spin one')
    assert.ok(css.includes('orbitSpinTwo'), 'CSS must define 3D orbital spin two')
    assert.ok(css.includes('orbitCoinFloat'), 'CSS must define floating levitation physics')
    assert.ok(css.includes('sparkleTwinkle'), 'CSS must define twinkling sparkles')
  })

  test('App.jsx hooks up CrewPoolCelebration and Review Art buttons', () => {
    const appPath = path.join(rootDir, 'src', 'App.jsx')
    const appSource = fs.readFileSync(appPath, 'utf8')

    assert.ok(appSource.includes('import CrewPoolCelebration'), 'Must import CrewPoolCelebration')
    assert.ok(appSource.includes('<CrewPoolCelebration'), 'Must render CrewPoolCelebration modal')
    assert.ok(appSource.includes('window.playCrewPoolCelebration'), 'Must expose window preview function')
    assert.ok(appSource.includes('onPreviewPoolCelebration'), 'Must pass onPreviewPoolCelebration prop')
    assert.ok(appSource.includes('✦ Pool Art') || appSource.includes('✦ Review Art'), 'Must render Review Art trigger')
  })
})
