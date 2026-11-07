// The camera signals are the one piece of Lexio's scoring that isn't a model
// call or arithmetic on a score — it's image measurement, and it runs on a
// student's face during a graded assessment. These tests drive it with
// synthetic frames so the geometry is checked without a webcam.
import { describe, expect, it } from 'vitest'

import { measureFrame, scoreFrame } from './useCameraPresence'

const WIDTH = 96
const HEIGHT = 72

const SKIN = [205, 150, 125] // mid-tone, comfortably inside the YCbCr window
const DARK_SKIN = [110, 75, 60]
const WALL = [200, 200, 205]

/** Paint a plain background, then a filled rectangle of `face` over it. */
function frame({ face = null, background = WALL, noise = 0 } = {}) {
  const pixels = new Uint8ClampedArray(WIDTH * HEIGHT * 4)
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const inFace =
        face && x >= face.x && x < face.x + face.w && y >= face.y && y < face.y + face.h
      const [r, g, b] = inFace ? face.colour ?? SKIN : background
      const jitter = inFace ? 0 : (x * 7 + y * 13) % (noise + 1)
      const offset = (y * WIDTH + x) * 4
      pixels[offset] = r + jitter
      pixels[offset + 1] = g + jitter
      pixels[offset + 2] = b + jitter
      pixels[offset + 3] = 255
    }
  }
  return pixels
}

// A head roughly centred, occupying a plausible share of the frame.
const CENTRED_FACE = { x: 34, y: 16, w: 28, h: 28 }

describe('measureFrame', () => {
  it('finds a face and reports where it sits', () => {
    const result = measureFrame(frame({ face: CENTRED_FACE }), WIDTH, HEIGHT)

    expect(result.found).toBe(true)
    expect(result.centreX).toBeCloseTo(0.5, 1)
    expect(result.centreY).toBeCloseTo(0.41, 1)
  })

  it('finds darker skin tones too', () => {
    // The usual RGB skin rule misses these; the YCbCr window is chosen so
    // this does not become an accessibility bug in a graded assessment.
    const result = measureFrame(
      frame({ face: { ...CENTRED_FACE, colour: DARK_SKIN } }),
      WIDTH,
      HEIGHT
    )
    expect(result.found).toBe(true)
  })

  it('reports no face for an empty room', () => {
    expect(measureFrame(frame(), WIDTH, HEIGHT).found).toBe(false)
  })

  it('rejects a region far too large to be a head', () => {
    const wall = measureFrame(frame({ face: { x: 0, y: 0, w: WIDTH, h: HEIGHT } }), WIDTH, HEIGHT)
    expect(wall.found).toBe(false)
  })

  it('reads a busy background as higher deviation than a plain one', () => {
    const plain = measureFrame(frame({ face: CENTRED_FACE }), WIDTH, HEIGHT)
    const busy = measureFrame(frame({ face: CENTRED_FACE, noise: 120 }), WIDTH, HEIGHT)
    expect(busy.backgroundDeviation).toBeGreaterThan(plain.backgroundDeviation)
  })
})

describe('scoreFrame', () => {
  const measure = (face, options) => measureFrame(frame({ face, ...options }), WIDTH, HEIGHT)

  it('scores a well-framed presenter highly', () => {
    const scores = scoreFrame(measure(CENTRED_FACE), null)

    expect(scores.framing).toBeGreaterThan(80)
    expect(scores.posture).toBeGreaterThan(80)
    expect(scores.eye_contact).toBeGreaterThan(90)
  })

  it('marks eye contact down when the presenter turns away', () => {
    const offToTheSide = scoreFrame(measure({ ...CENTRED_FACE, x: 2 }), null)
    expect(offToTheSide.eye_contact).toBeLessThan(60)
    expect(offToTheSide.framing).toBeLessThan(80)
  })

  it('varies continuously with how far off-centre the presenter drifts, rather than snapping between fixed values', () => {
    const centred = scoreFrame(measure(CENTRED_FACE), null)
    const slightlyOff = scoreFrame(measure({ ...CENTRED_FACE, x: CENTRED_FACE.x - 8 }), null)
    const wayOff = scoreFrame(measure({ ...CENTRED_FACE, x: CENTRED_FACE.x - 20 }), null)

    expect(centred.eye_contact).toBeGreaterThan(slightlyOff.eye_contact)
    expect(slightlyOff.eye_contact).toBeGreaterThan(wayOff.eye_contact)
  })

  it('marks posture down when the head drops low in frame', () => {
    const slouched = scoreFrame(measure({ ...CENTRED_FACE, y: 42 }), null)
    expect(slouched.posture).toBeLessThan(40)
  })

  it('gives nothing away when the presenter is out of frame', () => {
    const absent = scoreFrame(measure(null), null)

    expect(absent.eye_contact).toBe(0)
    expect(absent.framing).toBe(0)
    // Posture and steadiness are unknown, not zero — guessing them would
    // punish someone for a lighting problem.
    expect(absent.posture).toBeNull()
    expect(absent.steadiness).toBeNull()
  })

  it('has no steadiness reading on the very first sample', () => {
    expect(scoreFrame(measure(CENTRED_FACE), null).steadiness).toBeNull()
  })

  it('scores steadiness high when the presenter holds still', () => {
    const held = scoreFrame(measure(CENTRED_FACE), { x: 0.5, y: 0.41 })
    expect(held.steadiness).toBeGreaterThan(80)
  })

  it('scores steadiness low when the presenter sways', () => {
    const swaying = scoreFrame(measure(CENTRED_FACE), { x: 0.2, y: 0.41 })
    expect(swaying.steadiness).toBeLessThan(20)
  })

  it('penalises a cluttered background', () => {
    const plain = scoreFrame(measure(CENTRED_FACE), null)
    const busy = scoreFrame(measure(CENTRED_FACE, { noise: 140 }), null)
    expect(busy.background).toBeLessThan(plain.background)
  })

  it('penalises a room too dark to present in', () => {
    const dim = scoreFrame(measure(CENTRED_FACE, { background: [12, 12, 14] }), null)
    expect(dim.background).toBeLessThan(60)
  })
})
