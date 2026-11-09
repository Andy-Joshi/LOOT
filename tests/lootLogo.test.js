import assert from 'node:assert'
import { test, describe } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

describe('LootLogo Component & Animation Specs', () => {
  const logoJsxPath = join(rootDir, 'src', 'components', 'LootLogo.jsx')
  const logoCssPath = join(rootDir, 'src', 'components', 'LootLogo.css')
  const splashJsxPath = join(rootDir, 'src', 'components', 'SplashScreen.jsx')
  const splashCssPath = join(rootDir, 'src', 'components', 'SplashScreen.css')

  test('LootLogo and SplashScreen source and CSS files exist', () => {
    assert.ok(existsSync(logoJsxPath), 'LootLogo.jsx must exist')
    assert.ok(existsSync(logoCssPath), 'LootLogo.css must exist')
    assert.ok(existsSync(splashJsxPath), 'SplashScreen.jsx must exist')
    assert.ok(existsSync(splashCssPath), 'SplashScreen.css must exist')
  })

  test('LootLogo accepts intro, showWordmark, and size props with exact SVG viewboxes', () => {
    const src = readFileSync(logoJsxPath, 'utf8')

    // Props verification
    assert.ok(src.includes('intro = false'), 'Must support intro prop with false default')
    assert.ok(src.includes('showWordmark = true'), 'Must support showWordmark prop with true default')
    assert.ok(src.includes("size = 'md'"), "Must support size prop with 'md' default")

    // Exact viewbox specs from original HTML
    assert.ok(src.includes('70 88 260 195'), 'Full logo with wordmark must use viewBox 70 88 260 195')
    assert.ok(src.includes('98 92 210 135'), 'Mark only must use viewBox 98 92 210 135')

    // Unique SVG ids per instance
    assert.ok(src.includes('useId'), 'Must use React useId to generate unique SVG prefix per instance')
  })

  test('LootLogo SVG markup contains all exact elements from uploaded HTML', () => {
    const src = readFileSync(logoJsxPath, 'utf8')

    // Rupee symbol and card geometries
    assert.ok(src.includes('₹'), 'Front neon card must contain rupee (₹) character')
    assert.ok(src.includes('loot-logo-ring'), 'Must render animated orbital ring')
    assert.ok(src.includes('loot-logo-cm'), 'Must render orbital comet comets')
    assert.ok(src.includes('loot-logo-inb'), 'Must render back neon card with angle transform')
    assert.ok(src.includes('loot-logo-inf'), 'Must render front neon card with angle transform')
    assert.ok(src.includes('loot-logo-halo'), 'Must render radial glowing halo')
    assert.ok(src.includes('loot-logo-burst'), 'Must render burst circle')

    // Wordmark paths
    assert.ok(src.includes('loot-logo-slash'), 'Must render green accent slash')
    assert.ok(src.includes('loot-logo-shw'), 'Must render metallic sheen gradient')
    assert.ok(src.includes('loot-logo-tw'), 'Must render dynamic sparkles')
  })

  test('LootLogo.css contains exact keyframes, timings, and reduced motion override', () => {
    const css = readFileSync(logoCssPath, 'utf8')

    // Core keyframes
    assert.ok(css.includes('@keyframes lootLogoDraw'), 'Must include draw keyframe for ring')
    assert.ok(css.includes('@keyframes lootLogoPop'), 'Must include pop keyframe for rupee symbol')
    assert.ok(css.includes('@keyframes lootLogoBurst'), 'Must include burst keyframe')
    assert.ok(css.includes('@keyframes lootLogoGlow'), 'Must include glow keyframe')
    assert.ok(css.includes('@keyframes lootLogoTick'), 'Must include tick scaling keyframe')
    assert.ok(css.includes('@keyframes lootLogoRise'), 'Must include rise letter animation')
    assert.ok(css.includes('@keyframes lootLogoWipe'), 'Must include wipe slash animation')

    // Timings
    assert.ok(css.includes('4.2s'), 'Tick keyframe animation must be 4.2s')
    assert.ok(css.includes('3.4s'), 'Glow keyframe animation must be 3.4s')
    assert.ok(css.includes('3.8s'), 'Card floating animation must be 3.8s')
    assert.ok(css.includes('5.5s'), 'Sheen animation must be 5.5s')
    assert.ok(css.includes('2.8s'), 'Intro duration variable must be 2.8s')

    // Reduced motion accessibility
    assert.ok(css.includes('prefers-reduced-motion: reduce'), 'Must have prefers-reduced-motion media query')
    assert.ok(css.includes('animation: none !important'), 'Animations must be disabled in reduced motion')
  })

  test('SplashScreen plays LootLogo with intro=true for at least 4s and records once-per-session state', () => {
    const src = readFileSync(splashJsxPath, 'utf8')
    const css = readFileSync(splashCssPath, 'utf8')

    // Session storage key
    assert.ok(src.includes('sessionStorage'), 'Must check and store session state')
    assert.ok(src.includes('loot_splash_shown'), 'Must use session storage key loot_splash_shown')

    // Intro mode LootLogo
    assert.ok(src.includes('intro={true}'), 'SplashScreen must play LootLogo with intro={true}')
    assert.ok(src.includes("size=\"splash\""), 'Must render splash size')

    // Progress fill bar from HTML
    assert.ok(src.includes('loot-splash-bar'), 'Must render the progress fill bar')
    assert.ok(css.includes('lootSplashFill'), 'CSS must include the linear fill animation')
    assert.ok(src.includes('4000'), 'Must play for at least 4000ms')
    assert.ok(css.includes('opacity: 0'), 'CSS must support smooth fade out')
  })
})
