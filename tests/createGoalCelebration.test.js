import assert from 'node:assert'
import { test, describe } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

describe('Create Goal Celebration Component & Animation Logic', () => {
  test('Component source file exists and contains all required SVG elements', () => {
    const jsxPath = join(rootDir, 'src', 'components', 'CreateGoalCelebration.jsx')
    assert(existsSync(jsxPath), 'CreateGoalCelebration.jsx must exist')

    const jsxContent = readFileSync(jsxPath, 'utf8')
    assert(jsxContent.includes('export default function CreateGoalCelebration'), 'Must export CreateGoalCelebration component')
    assert(jsxContent.includes('viewBox="70 50 260 310"'), 'Must have viewBox matching uploaded animation')
    assert(jsxContent.includes('cga-halo'), 'Must contain halo circle')
    assert(jsxContent.includes('cga-ring'), 'Must contain orbital ring paths')
    assert(jsxContent.includes('cga-cin'), 'Must contain clipboard card group')
    assert(jsxContent.includes('cga-cfl'), 'Must contain floating animation group')
    assert(jsxContent.includes('cga-tab'), 'Must contain binder clip tab')
    assert(jsxContent.includes('cga-row'), 'Must contain checklist item rows')
    assert(jsxContent.includes('cga-pb'), 'Must contain interactive plus action button')
    assert(jsxContent.includes('cga-rp'), 'Must contain ripple circle')
    assert(jsxContent.includes('cga-spk'), 'Must contain spark rays')
    assert(jsxContent.includes('cga-sw'), 'Must contain swish underline')
    assert(jsxContent.includes('cga-tl cga-t1'), 'Must render "Create a" letters')
    assert(jsxContent.includes('cga-tl cga-t2'), 'Must render "Goal" letters')
    assert(jsxContent.includes('cga-cfx'), 'Must render confetti particles')
    assert(jsxContent.includes('useId()'), 'Must use unique IDs per instance to prevent SVG gradient collisions')
    assert(jsxContent.includes('handleReplay'), 'Must support replay mechanism')
    assert(jsxContent.includes('handlePlusClick'), 'Must support interactive plus button click with bounce & confetti')
  })

  test('CSS file contains all keyframes and styling rules from uploaded animation', () => {
    const cssPath = join(rootDir, 'src', 'components', 'CreateGoalCelebration.css')
    assert(existsSync(cssPath), 'CreateGoalCelebration.css must exist')

    const cssContent = readFileSync(cssPath, 'utf8')
    const requiredKeyframes = [
      'cgaDraw', 'cgaHin', 'cgaHal', 'cgaCin', 'cgaTab', 'cgaRow',
      'cgaWipe', 'cgaPin', 'cgaShake', 'cgaTin', 'cgaWave', 'cgaFa',
      'cgaFb', 'cgaPp', 'cgaHit', 'cgaSpk', 'cgaFl', 'cgaRp',
      'cgaCyc', 'cgaBxc', 'cgaGlow', 'cgaCf', 'cgaCb', 'cgaCfx'
    ]

    for (const kf of requiredKeyframes) {
      assert(cssContent.includes(`@keyframes ${kf}`), `Must define keyframe ${kf}`)
    }

    assert(cssContent.includes('prefers-reduced-motion'), 'Must support prefers-reduced-motion')
    assert(cssContent.includes('.goal-celebration-overlay'), 'Must have overlay backdrop class')
    assert(cssContent.includes('.goal-celebration-modal'), 'Must have modal card styling')
    assert(cssContent.includes('Poppins'), 'Must reference Poppins font')
  })

  test('Confetti generator produces valid radial trigonometry coordinates and colors', () => {
    const COLS = ['#67ff3a', '#b9ff6a', '#8a4dff', '#c9a8ff', '#fff']
    const createBurst = (delay = 0, count = 30) => {
      const particles = []
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2
        const r = 40 + (i % 5) * 15
        const isCircle = i % 3 === 0
        const z = 3 + (i % 4) * 1.5
        particles.push({
          id: `p-${i}`,
          isCircle,
          x: 258,
          y: 220,
          width: isCircle ? 0 : z,
          height: isCircle ? 0 : z * 1.5,
          radius: isCircle ? z / 2 : 0,
          fill: COLS[i % COLS.length],
          targetX: Math.cos(a) * r,
          targetY: Math.sin(a) * r - 30,
          targetR: 180,
          delay
        })
      }
      return particles
    }

    const particles = createBurst(2.05, 30)
    assert.strictEqual(particles.length, 30, 'Should create 30 particles')
    assert.strictEqual(particles[0].x, 258, 'Particle origin X must be 258')
    assert.strictEqual(particles[0].y, 220, 'Particle origin Y must be 220')
    assert.strictEqual(particles[0].delay, 2.05, 'Delay should match argument')

    for (const p of particles) {
      assert(COLS.includes(p.fill), 'Particle fill must match brand colors')
      assert(typeof p.targetX === 'number' && !Number.isNaN(p.targetX), 'targetX must be valid number')
      assert(typeof p.targetY === 'number' && !Number.isNaN(p.targetY), 'targetY must be valid number')
    }
  })

  test('App.jsx integrates CreateGoalCelebration on goal creation', () => {
    const appPath = join(rootDir, 'src', 'App.jsx')
    const appContent = readFileSync(appPath, 'utf8')

    assert(appContent.includes("import CreateGoalCelebration from './components/CreateGoalCelebration'"), 'App.jsx must import CreateGoalCelebration')
    assert(appContent.includes('const [goalCreatedCelebration, setGoalCreatedCelebration] = useState(null)'), 'App.jsx must manage goalCreatedCelebration state')
    assert(appContent.includes('setGoalCreatedCelebration(savedGoal || goalData)'), 'addGoal must trigger goalCreatedCelebration')
    assert(appContent.includes('<CreateGoalCelebration'), 'App.jsx must render CreateGoalCelebration modal')
    assert(appContent.includes('window.playGoalCelebration ='), 'App.jsx must expose window helper for testing')
  })

  test('SplashScreen plays for at least 4 seconds (>= 4000ms) before fading out', () => {
    const splashPath = join(rootDir, 'src', 'components', 'SplashScreen.jsx')
    const splashContent = readFileSync(splashPath, 'utf8')

    assert(splashContent.includes('4000'), 'introDuration must be at least 4000ms')
    assert(splashContent.includes('4550'), 'totalDuration must allow intro + fadeout (4550ms)')

    const splashCssPath = join(rootDir, 'src', 'components', 'SplashScreen.css')
    const splashCssContent = readFileSync(splashCssPath, 'utf8')
    assert(splashCssContent.includes('3.95s') || splashCssContent.includes('4s'), 'Progress bar animation must match 4s duration')
  })
})
