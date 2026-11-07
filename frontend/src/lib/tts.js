// Spoken lines for AI personas (GD peers, the Presentation doubt-round
// avatar) and the Listening clip. Tries the server's real voice synthesis
// first — apps.core.tts, Sarvam's native Indian-English voices (OpenAI as the
// server-side fallback), gender-matched to the
// persona so a male avatar is never handed a female voice — and only falls
// back to the browser's own speechSynthesis (lib/speechVoices.js) when that
// call fails outright: offline, no key configured, a network hiccup. A
// persona must always be able to "speak" even with nothing configured.
import { useAuthStore } from '../stores/useAuthStore'
import { voiceForGender } from './speechVoices'

function requestSpeech(text, gender, seed) {
  const token = useAuthStore.getState().accessToken
  return fetch('/api/assessment/tts/speak', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, gender, voice_seed: seed }),
  })
}

/**
 * Speaks one line out loud. Mirrors the SpeechSynthesisUtterance callback
 * shape it replaces (onstart/onend) so call sites barely change — `onEnd`
 * fires exactly once, however the line got spoken (or failed to), so it's
 * always safe to treat as "this persona is done talking, move on."
 * Returns a controller to cancel playback early (e.g. the student raises
 * their hand mid-line).
 */
export function speakLine(text, { gender = 'female', seed = '' } = {}, { onStart, onEnd } = {}) {
  if (!text) {
    onEnd?.()
    return { cancel: () => {} }
  }

  let cancelled = false
  let audio = null

  const speakWithBrowser = async () => {
    if (cancelled) return
    if (!window.speechSynthesis) {
      onEnd?.()
      return
    }
    const utterance = new SpeechSynthesisUtterance(text)
    const voice = await voiceForGender(gender, seed)
    if (cancelled) return
    if (voice) utterance.voice = voice
    utterance.onstart = () => onStart?.()
    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
  }

  requestSpeech(text, gender, seed)
    .then(async (res) => {
      if (cancelled) return
      if (res.status === 204 || !res.ok) throw new Error(`tts unavailable (${res.status})`)
      const blob = await res.blob()
      if (cancelled) return
      audio = new Audio(URL.createObjectURL(blob))
      audio.onplay = () => onStart?.()
      audio.onended = () => onEnd?.()
      audio.onerror = () => speakWithBrowser()
      await audio.play()
    })
    .catch(() => speakWithBrowser())

  return {
    cancel: () => {
      cancelled = true
      if (audio) {
        audio.pause()
        audio.onended = null
        audio.onerror = null
      }
      window.speechSynthesis?.cancel()
    },
  }
}
