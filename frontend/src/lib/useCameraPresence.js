// Camera-derived delivery signals for Presentation mode.
//
// What this is: the video frame is sampled twice a second onto a small
// offscreen canvas and measured in-browser. The frames never leave the
// machine — nothing is uploaded, nothing is recorded, only five aggregate
// numbers are submitted with the session. That locality is what makes camera
// use defensible at all; the LLD's own §21.8 flags camera analysis as needing
// privacy scoping, and this is that scoping.
//
// What this is NOT: a trained gaze or pose model. There is no face-landmark
// network here and no dependency that would ship one. The face is located by
// skin-chrominance segmentation in YCbCr (tone-robust in a way the usual RGB
// rule is not), and the five signals are honest geometric readings of where
// that region sits and how it moves:
//
//   framing     how well centred and sized you are in frame
//   posture     whether your head sits where an upright presenter's does
//   eye_contact share of the time you were square to the camera, not turned
//               away or looking down — a proxy for gaze, not a measurement
//               of it
//   steadiness  how much you drifted or swayed between samples
//   background  how busy and how well-lit the space behind you is
//
// The UI says as much, and the backend only lets these move one dimension
// (confidence), and only when there are enough samples to mean anything.
import { useCallback, useEffect, useRef, useState } from 'react'

const SAMPLE_INTERVAL_MS = 500
const FRAME_WIDTH = 96 // enough to segment a head; cheap enough to run on a phone
const FRAME_HEIGHT = 72

// Skin chrominance range in YCbCr. Wide on purpose — a false negative reads
// as "we can't see you", which is recoverable feedback; a narrow range that
// misses darker skin tones is not acceptable.
const CB_MIN = 77
const CB_MAX = 133
const CR_MIN = 131
const CR_MAX = 180

// Plausible share of the frame a head occupies at webcam distance. Outside
// this, whatever was detected isn't a face.
const MIN_FACE_AREA = 0.01
const MAX_FACE_AREA = 0.45

const IDEAL_CENTRE_X = 0.5
const IDEAL_CENTRE_Y = 0.42 // heads sit above the middle when you're upright
// Tolerances for the eye-contact proxy below — how far off-centre you can
// drift before the score has fallen to zero. Horizontal is tighter than
// vertical: turning away from the camera reads mostly as a sideways shift
// of the face blob, and posture already has the vertical axis covered.
const EYE_CONTACT_X_TOLERANCE = 0.3
const EYE_CONTACT_Y_TOLERANCE = 0.35

const clamp01 = (value) => Math.max(0, Math.min(1, value))
const toScore = (value) => Math.round(clamp01(value) * 100)

/** Locate the skin-coloured region and read the scene around it.
 *  Exported for testing — see useCameraPresence.test.js. */
export function measureFrame(pixels, width, height) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  let skinCount = 0

  let backgroundSum = 0
  let backgroundSquares = 0
  let backgroundCount = 0

  const luminance = new Float32Array(width * height)
  const isSkin = new Uint8Array(width * height)

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    const r = pixels[offset]
    const g = pixels[offset + 1]
    const b = pixels[offset + 2]

    const y = 0.299 * r + 0.587 * g + 0.114 * b
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    luminance[index] = y

    if (cb >= CB_MIN && cb <= CB_MAX && cr >= CR_MIN && cr <= CR_MAX && y > 40) {
      isSkin[index] = 1
      skinCount += 1
      const x = index % width
      const row = (index - x) / width
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (row < minY) minY = row
      if (row > maxY) maxY = row
    }
  }

  for (let index = 0; index < width * height; index += 1) {
    if (isSkin[index]) continue
    const y = luminance[index]
    backgroundSum += y
    backgroundSquares += y * y
    backgroundCount += 1
  }

  const areaRatio = skinCount / (width * height)
  const found = areaRatio >= MIN_FACE_AREA && areaRatio <= MAX_FACE_AREA && maxX > minX

  const backgroundMean = backgroundCount ? backgroundSum / backgroundCount : 0
  const backgroundVariance = backgroundCount
    ? Math.max(0, backgroundSquares / backgroundCount - backgroundMean * backgroundMean)
    : 0

  return {
    found,
    centreX: found ? (minX + maxX) / 2 / width : null,
    centreY: found ? (minY + maxY) / 2 / height : null,
    areaRatio,
    backgroundMean,
    backgroundDeviation: Math.sqrt(backgroundVariance),
  }
}

/** Turn one frame's geometry into the five signals. Exported for testing. */
export function scoreFrame(frame, previousCentre) {
  // A busy, cluttered or badly-lit wall costs a presenter attention that
  // should be on them. Measured whether or not we can see their face.
  //
  // The divisor here has to be calibrated against a *downscaled* 96x72
  // frame, not a full-resolution one: at that size, ordinary sensor noise
  // and lighting gradients on an unremarkable wall routinely produce a
  // luminance standard deviation in the 70-130 range even though nothing
  // about the room is actually busy. A divisor of 70 saturated `clutter` to
  // 1 for nearly any real background, which floor-clamped this score to the
  // same ~20 regardless of the room. 150 leaves headroom for that baseline
  // noise before the score starts moving.
  const clutter = clamp01(frame.backgroundDeviation / 150)
  const exposure =
    frame.backgroundMean < 45
      ? clamp01(frame.backgroundMean / 45)
      : frame.backgroundMean > 215
        ? clamp01((255 - frame.backgroundMean) / 40)
        : 1
  // Multiplicative, not a weighted sum: a background only works if it is both
  // quiet *and* lit well enough to see. Averaging the two let a pitch-dark
  // room score in the seventies on the strength of having nothing in it.
  const background = toScore((1 - clutter * 0.7) * exposure)

  if (!frame.found) {
    // Not visible: framing and eye contact are genuinely zero for this sample,
    // posture and steadiness are unknown and shouldn't be guessed at.
    return { framing: 0, eye_contact: 0, posture: null, steadiness: null, background }
  }

  const offsetX = Math.abs(frame.centreX - IDEAL_CENTRE_X)
  const offsetY = Math.abs(frame.centreY - IDEAL_CENTRE_Y)

  const centred = 1 - clamp01(offsetX / 0.35)
  const sized =
    frame.areaRatio < 0.05
      ? clamp01(frame.areaRatio / 0.05) // too far from the camera
      : frame.areaRatio > 0.3
        ? clamp01((MAX_FACE_AREA - frame.areaRatio) / 0.15) // filling the frame
        : 1
  const framing = toScore(centred * 0.55 + sized * 0.45)

  const posture = toScore(1 - clamp01(offsetY / 0.3))
  // A continuous falloff from dead-centre, not a threshold: the previous
  // version snapped to a flat 100 for anyone roughly centred and upright —
  // which, for someone actually presenting into a webcam, is nearly all the
  // time — so the number never moved regardless of how much they turned
  // away. This still can't see gaze itself (no eye/iris tracking here, see
  // the module docstring), only how far the face's position has drifted
  // from where "looking at the camera" tends to sit.
  const gazeOffset = Math.hypot(offsetX / EYE_CONTACT_X_TOLERANCE, offsetY / EYE_CONTACT_Y_TOLERANCE)
  const eyeContact = toScore(1 - clamp01(gazeOffset))

  let steadiness = null
  if (previousCentre) {
    const drift = Math.hypot(frame.centreX - previousCentre.x, frame.centreY - previousCentre.y)
    steadiness = toScore(1 - clamp01(drift / 0.08))
  }

  return { framing, eye_contact: Math.round(eyeContact), posture, steadiness, background }
}

const SIGNALS = ['framing', 'eye_contact', 'posture', 'steadiness', 'background']

export function useCameraPresence() {
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState(null)
  const [live, setLive] = useState(null)
  const [faceVisible, setFaceVisible] = useState(false)

  const videoElementRef = useRef(null)
  const streamRef = useRef(null)
  const canvasRef = useRef(null)
  const timerRef = useRef(null)
  const previousCentreRef = useRef(null)
  // Running totals rather than a growing array — a ten-minute session at 2Hz
  // is 1200 samples and none of them are needed individually.
  const totalsRef = useRef(null)

  const resetTotals = () => {
    totalsRef.current = {
      samples: 0,
      faceSamples: 0,
      sums: Object.fromEntries(SIGNALS.map((key) => [key, 0])),
      counts: Object.fromEntries(SIGNALS.map((key) => [key, 0])),
    }
  }

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    previousCentreRef.current = null
  }, [])

  useEffect(() => cleanup, [cleanup])

  /**
   * A callback ref, not a plain one: the `<video>` element usually mounts
   * *after* `start()` has already acquired the stream (the caller switches to
   * its presenting view once start resolves). Assigning srcObject inside
   * start() therefore ran against a null ref, the element never received
   * frames, readyState stayed at 0, and every sample was skipped — the camera
   * light was on and nothing whatsoever was measured. Binding on mount fixes
   * that whichever order the two happen in.
   */
  const attachStream = useCallback((element) => {
    videoElementRef.current = element
    if (element && streamRef.current && element.srcObject !== streamRef.current) {
      element.srcObject = streamRef.current
      element.play().catch(() => {})
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    resetTotals()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      })
      streamRef.current = stream
      attachStream(videoElementRef.current) // already mounted? bind now.

      const canvas = document.createElement('canvas')
      canvas.width = FRAME_WIDTH
      canvas.height = FRAME_HEIGHT
      canvasRef.current = canvas
      const context = canvas.getContext('2d', { willReadFrequently: true })

      timerRef.current = setInterval(() => {
        const video = videoElementRef.current
        if (!video || video.readyState < 2) return

        context.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT)
        const { data } = context.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT)
        const frame = measureFrame(data, FRAME_WIDTH, FRAME_HEIGHT)
        const scores = scoreFrame(frame, previousCentreRef.current)
        previousCentreRef.current = frame.found ? { x: frame.centreX, y: frame.centreY } : null

        const totals = totalsRef.current
        totals.samples += 1
        if (frame.found) totals.faceSamples += 1
        SIGNALS.forEach((key) => {
          if (scores[key] == null) return
          totals.sums[key] += scores[key]
          totals.counts[key] += 1
        })

        setFaceVisible(frame.found)
        setLive(scores)
      }, SAMPLE_INTERVAL_MS)

      setIsActive(true)
    } catch (err) {
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera access was blocked. You can still present — we just won’t be able to read your delivery.'
          : `Could not start the camera: ${err.message}`
      )
    }
  }, [])

  const stop = useCallback(() => {
    cleanup()
    setIsActive(false)
    setFaceVisible(false)
  }, [cleanup])

  /** The aggregate submitted with the session. Null when the camera never ran. */
  const summary = useCallback(() => {
    const totals = totalsRef.current
    if (!totals || !totals.samples) return null
    // A signal with no readings is left out, not reported as zero — posture
    // was never measured is a different claim from posture was terrible.
    const averages = {}
    SIGNALS.forEach((key) => {
      if (totals.counts[key]) averages[key] = Math.round(totals.sums[key] / totals.counts[key])
    })
    return {
      ...averages,
      samples: totals.samples,
      face_seconds: Math.round((totals.faceSamples * SAMPLE_INTERVAL_MS) / 1000),
    }
  }, [])

  // `videoRef` is the callback ref the caller puts on its <video> element.
  return { videoRef: attachStream, isActive, faceVisible, live, error, start, stop, summary }
}

export const PRESENCE_LABELS = {
  eye_contact: 'Eye contact',
  posture: 'Posture',
  framing: 'Framing',
  steadiness: 'Steadiness',
  background: 'Background',
}
