import assert from 'node:assert'
import { test, describe } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

describe('Pitch Celebration ("Boom! Pitch made") Component & Animation Suite', () => {
  test('Component source file exists and contains all required SVG elements and structure', () => {
    const jsxPath = join(rootDir, 'src', 'components', 'PitchCelebration.jsx')
    assert(existsSync(jsxPath), 'PitchCelebration.jsx must exist')

    const jsxContent = readFileSync(jsxPath, 'utf8')
    assert(jsxContent.includes('export default function PitchCelebration'), 'Must export PitchCelebration component')
    assert(jsxContent.includes('viewBox="0 0 1000 563"'), 'Must have viewBox matching uploaded animation (1000x563)')
    assert(jsxContent.includes('pca-mg'), 'Must contain megaphone group')
    assert(jsxContent.includes('pca-mgi'), 'Must contain megaphone intro group')
    assert(jsxContent.includes('pca-mgk'), 'Must contain megaphone kick group')
    assert(jsxContent.includes('M-85 -30L95 -86A30 86 0 0 1 95 86L-85 30Q-100 0 -85 -30Z'), 'Must contain megaphone cone path')
    assert(jsxContent.includes('pca-waves'), 'Must contain sound wave group')
    assert(jsxContent.includes('pca-wv'), 'Must contain sound wave arcs')
    assert(jsxContent.includes('pca-ray'), 'Must contain spark rays')
    assert(jsxContent.includes('pca-chk'), 'Must contain checkmark group')
    assert(jsxContent.includes('pca-ck'), 'Must contain checkmark path')
    assert(jsxContent.includes('M528 230L541 243L564 216'), 'Must contain exact checkmark coordinates')
    assert(jsxContent.includes('pca-cr'), 'Must contain checkmark ring')
    assert(jsxContent.includes('pca-sweep'), 'Must contain light sweep')
    assert(jsxContent.includes('pca-pan'), 'Must contain panel group')
    assert(jsxContent.includes('useId()'), 'Must use unique IDs per instance to prevent SVG gradient & filter collisions')
    assert(jsxContent.includes('handleReplay'), 'Must support replay mechanism')
    assert(jsxContent.includes('canvasRef'), 'Must contain HTML5 canvas for 3D tumbling confetti and shockwaves')
    assert(jsxContent.includes('playPitchFanfareSound'), 'Must support sound effects with fanfare synthesis')
  })

  test('CSS file contains all keyframes, gradients, and responsive rules from uploaded animation', () => {
    const cssPath = join(rootDir, 'src', 'components', 'PitchCelebration.css')
    assert(existsSync(cssPath), 'PitchCelebration.css must exist')

    const cssContent = readFileSync(cssPath, 'utf8')
    const requiredKeyframes = [
      'pcaDrop', 'pcaRise', 'pcaMgin', 'pcaKick', 'pcaWave',
      'pcaRayp', 'pcaStamp', 'pcaChkp', 'pcaCrp', 'pcaDcf',
      'pcaTw', 'pcaPcm', 'pcaSweep', 'pcaBulge', 'pcaShake', 'pcaFlash'
    ]

    for (const kf of requiredKeyframes) {
      assert(cssContent.includes(`@keyframes ${kf}`), `Must define keyframe ${kf}`)
    }

    assert(cssContent.includes('prefers-reduced-motion'), 'Must support prefers-reduced-motion')
    assert(cssContent.includes('.pitch-celebration-overlay'), 'Must have overlay backdrop class')
    assert(cssContent.includes('.pitch-celebration-modal'), 'Must have modal card styling')
    assert(cssContent.includes('Poppins'), 'Must reference Poppins font')
    assert(cssContent.includes('@media (max-width: 640px)'), 'Must include mobile responsive styles')
  })

  test('SFX utility exports pitch fanfare sound generator', () => {
    const sfxPath = join(rootDir, 'src', 'utils', 'sfx.js')
    assert(existsSync(sfxPath), 'src/utils/sfx.js must exist')

    const sfxContent = readFileSync(sfxPath, 'utf8')
    assert(sfxContent.includes('export function playPitchFanfareSound'), 'Must export playPitchFanfareSound')
    assert(sfxContent.includes('ctx.createBiquadFilter'), 'Must use Web Audio filters for acoustic brass fanfare tone')
    assert(sfxContent.includes('sawtooth'), 'Must utilize sawtooth waveforms for brassy trumpet attack')
  })

  test('App.jsx integrates PitchCelebration and Review Art triggers', () => {
    const appPath = join(rootDir, 'src', 'App.jsx')
    const appContent = readFileSync(appPath, 'utf8')

    assert(appContent.includes("import PitchCelebration from './components/PitchCelebration'"), 'Must import PitchCelebration in App.jsx')
    assert(appContent.includes('pitchCelebration'), 'Must have pitchCelebration state in App.jsx')
    assert(appContent.includes('setPitchCelebration'), 'Must update pitchCelebration state')
    assert(appContent.includes('playPitchCelebration'), 'Must expose window.playPitchCelebration for testing/preview')
    assert(appContent.includes('✦ Pitch Art'), 'Must have header action for Ask Parent')
    assert(appContent.includes('✦ Review Art'), 'Must have Review Art button on pitch cards')
    assert(appContent.includes('<PitchCelebration'), 'Must render PitchCelebration modal')
  })
})
