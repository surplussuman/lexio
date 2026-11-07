// Fallback voice selection for AI personas (GD peers, the Presentation
// doubt-round avatar) when the server's real TTS call fails outright — see
// lib/tts.js, which is the actual primary path now (apps.core.tts, OpenAI
// voices, Indian-accented). This only matters offline, or if no key is
// configured at all: pick a browser voice that at least matches the
// persona's gender, rather than the old behaviour of picking whichever
// voice happened to sit at a given index — which is what put a female voice
// on a male avatar just because of list order.
//
// Voices load asynchronously in Chrome — this resolves once they're
// actually available rather than racing the empty initial list.
let cachedVoices = null
let loadPromise = null

function loadVoices() {
  if (!window.speechSynthesis) return Promise.resolve([])
  if (cachedVoices) return Promise.resolve(cachedVoices)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices()
    if (existing.length) {
      cachedVoices = existing
      resolve(existing)
      return
    }
    window.speechSynthesis.onvoiceschanged = () => {
      cachedVoices = window.speechSynthesis.getVoices()
      resolve(cachedVoices)
    }
    // Some browsers never fire the event if the list was already cached
    // internally — fall back after a short wait rather than hanging.
    setTimeout(() => {
      if (!cachedVoices) {
        cachedVoices = window.speechSynthesis.getVoices()
        resolve(cachedVoices)
      }
    }, 300)
  })
  return loadPromise
}

// SpeechSynthesisVoice carries no structured gender field, only a vendor
// name — these are the common ones that actually say so, or are well-known
// to read as one gender or the other.
const FEMALE_HINTS = /female|zira|samantha|victoria|susan|karen|moira|tessa|fiona|nova|shimmer|coral/i
const MALE_HINTS = /male|david|mark|daniel|alex|fred|george|onyx|echo|ash/i

function guessGender(voice) {
  if (FEMALE_HINTS.test(voice.name)) return 'female'
  if (MALE_HINTS.test(voice.name)) return 'male'
  return null
}

function hashSeed(seed) {
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return hash
}

/** A stable voice for a persona matching the requested gender as best the
 * browser's own voice list allows — the same seed always resolves to the
 * same voice, so a peer or avatar doesn't change voice mid-conversation. */
export async function voiceForGender(gender, seed = '') {
  const voices = await loadVoices()
  const english = voices.filter((voice) => voice.lang?.startsWith('en'))
  const pool = english.length ? english : voices
  const matched = pool.filter((voice) => guessGender(voice) === gender)
  const candidates = matched.length ? matched : pool
  if (!candidates.length) return null
  return candidates[hashSeed(seed) % candidates.length]
}
