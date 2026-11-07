// Group Discussion — a live room, not a stopwatch exercise.
//
// A table sits at the centre with three AI peers around three of its sides
// and the student on the fourth. A lobby comes first ("Enter room"); once
// in, the peers speak their opening lines one at a time — real synthesized
// voices per persona, gender-matched to their seat's avatar (lib/tts.js,
// apps.core.tts; falls back to the browser's own speechSynthesis only if
// that call fails) — and from then on the floor is simply open. There is no
// fixed "speak for 2 minutes": the student raises a hand whenever they want
// the floor, talks for as long as they need, and lowers it when they're
// done. Nothing else waits on a timer.
//
// After each of the student's turns, one AI peer responds — building on the
// point, pushing back, or asking them something directly — and if the
// student goes quiet for a while without ever having spoken, a peer calls
// on them by name. All of this happens against ONE continuous recording
// (started on "Enter room", stopped on submit): peers' spoken audio plays
// through the browser's output, never the student's own microphone, so the
// recording is naturally just the student's own words, turn by turn. The
// full turn log travels with the submission (`discussion_log`) so scoring
// has the room's side of the conversation too, not just the transcript in
// isolation — see apps/analysis/gd.py.
import { useEffect, useMemo, useRef, useState } from 'react'

import { useRecorder } from '../../../components/Recorder'
import { AVATAR_IDS, AvatarPlayer, Button, Icon, Pill, avatarGender } from '../../../components/primitives'
import { useGdTurn } from '../../../lib/assessmentApi'
import { speakLine } from '../../../lib/tts'
import { useSpeechRecognition } from '../../../lib/useSpeechRecognition'

const ROOM_BUDGET_SECONDS = 420 // 7 minutes of live discussion before the room starts wrapping up
const IDLE_NUDGE_AFTER_S = 40 // open-floor seconds (excluding anyone talking) before a silent student is called on
const CONTINUE_PAUSE_S = 3 // open-floor seconds before a peer fills a silence that isn't the student's fault

// Avatars are picked to match each peer's actual gender (`peers[].gender`,
// now always set — generated peers carry it from `generation.py`, and the
// seeded fallback bank has it hardcoded), not by seat position. Seat position
// used to drive it directly, which meant a peer named e.g. "Priya" could
// just as easily land on a male portrait — the avatar, and therefore the
// voice (avatarGender feeds lib/tts.js), had nothing to do with who the AI
// actually said was speaking.
const MALE_AVATAR_IDS = AVATAR_IDS.filter((id) => avatarGender(id) === 'male')
const FEMALE_AVATAR_IDS = AVATAR_IDS.filter((id) => avatarGender(id) === 'female')

function assignAvatars(peers) {
  let maleCount = 0
  let femaleCount = 0
  return peers.map((peer) => {
    if (peer.gender === 'male') return MALE_AVATAR_IDS[maleCount++ % MALE_AVATAR_IDS.length]
    femaleCount += 1
    return FEMALE_AVATAR_IDS[(femaleCount - 1) % FEMALE_AVATAR_IDS.length]
  })
}

const formatTime = (total) =>
  `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(Math.floor(total % 60)).padStart(2, '0')}`

function Seat({ label, avatarId, active }) {
  return (
    <div className="flex flex-col items-center" style={{ width: 116 }}>
      {avatarId ? (
        <AvatarPlayer avatarId={avatarId} height={104} talking={active} />
      ) : (
        <div
          className="rounded-full flex items-center justify-center font-mono text-[13px] text-white"
          style={{
            width: 64,
            height: 64,
            background: 'var(--color-accent)',
            boxShadow: active ? '0 0 0 5px var(--color-accent-soft)' : 'none',
            transition: 'box-shadow 0.2s',
          }}
        >
          {label}
        </div>
      )}
      <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mt-1 text-center truncate w-full">
        {avatarId ? label : 'You'}
      </div>
    </div>
  )
}

/** Four sides, one table: up to three peers on three of them, the student on
 * the fourth — a CSS grid, not a stacked list. Nothing under a peer's name
 * hints at their position or their line before they've actually said it —
 * that was the earlier "spoiler" bug, just one layer deeper than the caption
 * box (a peer's stance sentence sat there permanently, from before they'd
 * even opened their mouth). */
function Table({ peers, avatarIds, speakingIndex, youActive, motion }) {
  const seatFor = (index) =>
    peers[index] ? (
      <Seat label={peers[index].name} avatarId={avatarIds[index]} active={speakingIndex === index} />
    ) : null

  return (
    <div className="bg-white border border-rule rounded-xl p-6 mb-5">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gridTemplateRows: 'auto auto auto',
          gridTemplateAreas: '". top ." "left middle right" ". bottom ."',
          gap: 14,
          alignItems: 'center',
          justifyItems: 'center',
        }}
      >
        <div style={{ gridArea: 'top' }}>{seatFor(0)}</div>
        <div style={{ gridArea: 'left' }}>{seatFor(1)}</div>
        <div style={{ gridArea: 'right' }}>{seatFor(2)}</div>
        <div style={{ gridArea: 'middle' }} className="w-full flex justify-center">
          <div
            className="bg-paper-2 border border-rule rounded-full flex items-center justify-center px-6 text-center"
            style={{ width: 210, minHeight: 90 }}
          >
            <span className="font-ser text-[13px] text-ink-2 leading-snug" style={{ letterSpacing: -0.2 }}>
              {motion}
            </span>
          </div>
        </div>
        <div style={{ gridArea: 'bottom' }}>
          <Seat label="YOU" active={youActive} />
        </div>
      </div>
    </div>
  )
}

export function GdInterface({ session, onSubmit, isSubmitting }) {
  const peers = session.prompt.payload?.peers ?? []
  const motion = session.prompt.text

  const [phase, setPhase] = useState('room') // room | live | review
  const [log, setLog] = useState([])
  const [openingIndex, setOpeningIndex] = useState(0)
  const [openingsDone, setOpeningsDone] = useState(false)
  const [handRaised, setHandRaised] = useState(false)
  const [speakingPeerIndex, setSpeakingPeerIndex] = useState(-1)
  const [pendingTurn, setPendingTurn] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [wrappingUp, setWrappingUp] = useState(false)
  // What the caption box shows — set ONLY when a line actually starts
  // playing (never the moment it's queued), so nothing is ever visible
  // before the avatar has actually started speaking it. It's left in place
  // once that line ends, so the room doesn't go blank between turns; the
  // next onStart is what replaces it.
  const [activeCaption, setActiveCaption] = useState('')

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const peerAvatarIds = useMemo(() => assignAvatars(peers), [session.id])

  const recorder = useRecorder()
  const speech = useSpeechRecognition()
  const gdTurn = useGdTurn()

  const turnStartRef = useRef(0)
  const transcriptMarkRef = useRef(0)
  const transcriptRef = useRef('')
  transcriptRef.current = speech.finalTranscript
  const speechRef = useRef(null)
  useEffect(() => () => speechRef.current?.cancel(), [])

  // Mirrors of state for the once-a-second scheduler below, which runs
  // inside a setInterval closure that would otherwise only ever see the
  // values from the render that created it.
  const handRaisedRef = useRef(false)
  handRaisedRef.current = handRaised
  const pendingTurnRef = useRef(false)
  pendingTurnRef.current = pendingTurn
  const speakingRef = useRef(false)
  speakingRef.current = speakingPeerIndex !== -1
  const openingsDoneRef = useRef(false)
  openingsDoneRef.current = openingsDone
  const wrappingUpRef = useRef(false)
  wrappingUpRef.current = wrappingUp
  const everSpokeRef = useRef(false)
  const silentSecondsRef = useRef(0)
  const neverSpokenSecondsRef = useRef(0)
  const logRef = useRef([])
  logRef.current = log

  const speakTurn = (turn) => {
    const index = peers.findIndex((peer) => peer.name === turn.peer)
    setLog((prev) => [
      ...prev,
      { speaker: turn.peer, text: turn.text, role: 'peer', seconds: 0, addressedStudent: turn.addresses_student },
    ])
    speechRef.current?.cancel()
    speechRef.current = speakLine(
      turn.text,
      { gender: peers[Math.max(index, 0)]?.gender ?? 'female', seed: turn.peer },
      {
        onStart: () => {
          setSpeakingPeerIndex(index)
          setPendingTurn(false)
          setActiveCaption(turn.text)
        },
        onEnd: () => setSpeakingPeerIndex(-1),
      }
    )
  }

  const requestNextTurn = async (event, historyOverride) => {
    if (pendingTurnRef.current || handRaisedRef.current) return
    setPendingTurn(true)
    try {
      const { turn } = await gdTurn.mutateAsync({
        sessionId: session.id,
        history: (historyOverride ?? logRef.current).slice(-16),
        event,
      })
      if (!turn || handRaisedRef.current) {
        setPendingTurn(false)
        return
      }
      speakTurn(turn)
    } catch {
      setPendingTurn(false)
    }
  }

  // Opening statements, one at a time, until the roster is through or the
  // student cuts in early.
  useEffect(() => {
    if (phase !== 'live' || openingsDone || handRaised) return undefined
    if (openingIndex >= peers.length) {
      setOpeningsDone(true)
      return undefined
    }
    const peer = peers[openingIndex]
    const text = peer.opening ?? peer.statement ?? ''
    setLog((prev) => [...prev, { speaker: peer.name, text, role: 'peer', seconds: 0 }])

    const controller = speakLine(
      text,
      { gender: peer.gender ?? 'female', seed: peer.name },
      {
        onStart: () => {
          setSpeakingPeerIndex(openingIndex)
          setActiveCaption(text)
        },
        onEnd: () => {
          setSpeakingPeerIndex(-1)
          setOpeningIndex((index) => index + 1)
        },
      }
    )
    return () => controller.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, openingIndex, openingsDone, handRaised, peers])

  // The room's heartbeat: keeps the overall clock, fills a silence with
  // another peer's point, and — if the student has never taken the floor —
  // eventually has someone call on them by name.
  useEffect(() => {
    if (phase !== 'live') return undefined
    const timer = setInterval(() => {
      setElapsed((seconds) => {
        const next = seconds + 1
        if (next >= ROOM_BUDGET_SECONDS) setWrappingUp(true)
        return next
      })

      if (wrappingUpRef.current) return
      if (handRaisedRef.current || pendingTurnRef.current || speakingRef.current || !openingsDoneRef.current) {
        silentSecondsRef.current = 0
        return
      }
      silentSecondsRef.current += 1
      if (!everSpokeRef.current) neverSpokenSecondsRef.current += 1

      if (!everSpokeRef.current && neverSpokenSecondsRef.current >= IDLE_NUDGE_AFTER_S) {
        neverSpokenSecondsRef.current = 0
        silentSecondsRef.current = 0
        requestNextTurn('idle_nudge')
        return
      }
      if (silentSecondsRef.current >= CONTINUE_PAUSE_S) {
        silentSecondsRef.current = 0
        requestNextTurn('continue')
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, 1000)
    return () => clearInterval(timer)
  }, [phase])

  const enterRoom = async () => {
    await recorder.start()
    speech.reset()
    speech.start()
    setPhase('live')
  }

  const raiseHand = () => {
    speechRef.current?.cancel()
    setSpeakingPeerIndex(-1)
    setPendingTurn(false)
    if (!openingsDone) setOpeningsDone(true)
    turnStartRef.current = Date.now()
    transcriptMarkRef.current = transcriptRef.current.length
    setHandRaised(true)
  }

  const lowerHand = () => {
    const transcript = transcriptRef.current.slice(transcriptMarkRef.current).trim()
    const seconds = (Date.now() - turnStartRef.current) / 1000
    transcriptMarkRef.current = transcriptRef.current.length
    const entry = { speaker: 'You', text: transcript, role: 'student', seconds }
    const updatedLog = [...logRef.current, entry]
    setLog(updatedLog)
    setActiveCaption(transcript)
    everSpokeRef.current = true
    setHandRaised(false)
    // A ref mirrors state for the heartbeat's setInterval closure (see
    // below), but this call happens synchronously, in the same tick as the
    // setHandRaised above — before React has re-rendered and refreshed that
    // mirror. Without updating it here directly too, requestNextTurn reads
    // the stale "still raised" value and silently no-ops: the one thing a
    // peer is actually supposed to do after every turn — react to what was
    // just said — never fired.
    handRaisedRef.current = false
    requestNextTurn('after_student', updatedLog)
  }

  const finishDiscussion = () => {
    speechRef.current?.cancel()
    recorder.stop()
    speech.stop()
    setPhase('review')
  }

  const submit = () => {
    const studentSeconds = Math.round(
      log.filter((entry) => entry.role === 'student').reduce((sum, entry) => sum + (entry.seconds || 0), 0)
    )
    onSubmit({ audioBlob: recorder.blob, durationSeconds: studentSeconds, discussionLog: log })
  }

  if (!peers.length) {
    return <p className="text-bad text-sm">This discussion has no participants — try starting it again.</p>
  }

  const hasSpoken = log.some((entry) => entry.role === 'student')

  if (phase === 'room') {
    return (
      <div>
        <Table peers={peers} avatarIds={peerAvatarIds} speakingIndex={-1} youActive={false} motion={motion} />
        <div className="bg-paper-2 border border-rule rounded-[10px] p-4 mb-6">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-1.5">Before you go in</div>
          <p className="text-[13px] text-ink-2 leading-relaxed">
            The room opens with each peer stating their position. There's no fixed turn or clock
            for you — raise your hand whenever you want the floor, speak for as long as you need,
            then lower it. Peers will react, keep the discussion moving, or call on you by name if
            you've been quiet a while.
          </p>
        </div>
        <div className="flex items-center">
          <span className="text-[13px] text-ink-3">Your microphone starts once you enter.</span>
          <div className="flex-1" />
          <Button variant="accent" size="lg" icon={Icon.arrow} onClick={enterRoom}>
            Enter room
          </Button>
        </div>
        {recorder.error && <p className="text-bad text-[12px] mt-3">{recorder.error}</p>}
      </div>
    )
  }

  if (phase === 'live') {
    const speakingPeer = speakingPeerIndex >= 0 ? peers[speakingPeerIndex] : null
    return (
      <div>
        <div className="flex items-center gap-3 mb-4">
          <Pill tone={wrappingUp ? 'bad' : 'accent'}>{wrappingUp ? '● Wrapping up' : '● LIVE'}</Pill>
          <span className="font-mono text-[11px] text-ink-3">{formatTime(elapsed)}</span>
          {handRaised && <Pill tone="bad">✋ You have the floor</Pill>}
        </div>

        <Table peers={peers} avatarIds={peerAvatarIds} speakingIndex={speakingPeerIndex} youActive={handRaised} motion={motion} />

        <div className="bg-paper-2 border border-rule rounded-[10px] p-4 mb-4 min-h-[64px]">
          <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-1.5 flex items-center gap-2">
            <span>
              {handRaised
                ? "You're speaking — the room is listening"
                : speakingPeer
                  ? `${speakingPeer.name} is speaking`
                  : pendingTurn
                    ? 'Someone is about to jump in'
                    : 'The floor is open'}
            </span>
            {pendingTurn && (
              <span className="inline-flex gap-[3px]" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="block w-[4px] h-[4px] rounded-full bg-accent"
                    style={{ animation: `gd-thinking-dot 1s ${i * 0.15}s infinite ease-in-out` }}
                  />
                ))}
              </span>
            )}
          </div>
          {pendingTurn && (
            <style>{`
              @keyframes gd-thinking-dot { 0%, 80%, 100% { opacity: 0.25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-2px); } }
            `}</style>
          )}
          {handRaised ? (
            speech.isSupported ? (
              <p className="text-[13.5px] text-ink-2 leading-relaxed">
                {speech.finalTranscript.slice(transcriptMarkRef.current) || (
                  <span className="text-ink-4">Listening…</span>
                )}
                <span className="text-ink-4"> {speech.interimTranscript}</span>
              </p>
            ) : (
              <p className="text-[12.5px] text-ink-4">
                Live captions need Chrome or Edge. Your voice is still being recorded and scored.
              </p>
            )
          ) : (
            <p className="text-[13.5px] text-ink-2 leading-relaxed">
              {activeCaption || 'Raise your hand whenever you want to jump in.'}
            </p>
          )}
          {speech.error && <p className="text-bad text-[11px] mt-1.5">{speech.error}</p>}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[13px] text-ink-3">
            {hasSpoken ? "Wrap it up whenever you're ready." : 'Speak at least once before you can finish.'}
          </span>
          <div className="flex-1" />
          {!handRaised ? (
            <Button variant="accent" size="lg" icon={Icon.arrow} onClick={raiseHand} disabled={pendingTurn}>
              Raise your hand
            </Button>
          ) : (
            <Button variant="danger" size="lg" onClick={lowerHand}>
              Lower hand — I'm done
            </Button>
          )}
          {!handRaised && (
            <button
              type="button"
              onClick={finishDiscussion}
              disabled={!hasSpoken}
              className="text-[13px] text-ink-3 px-4 py-2 disabled:opacity-40"
            >
              Finish discussion
            </button>
          )}
        </div>
      </div>
    )
  }

  const studentTurns = log.filter((entry) => entry.role === 'student')
  const studentSeconds = Math.round(studentTurns.reduce((sum, entry) => sum + (entry.seconds || 0), 0))

  return (
    <div>
      <h2 className="font-ser text-[26px] mb-1" style={{ letterSpacing: -0.4 }}>
        That's the room.
      </h2>
      <p className="text-[14px] text-ink-3 mb-6">
        You spoke {studentTurns.length} time{studentTurns.length === 1 ? '' : 's'}, {formatTime(studentSeconds)} in
        total, across a {formatTime(elapsed)} discussion. Echo will take it from here.
      </p>

      <div className="bg-white border border-rule rounded-xl p-5 mb-6">
        <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">The conversation</div>
        <div className="space-y-2.5 max-h-[280px] overflow-y-auto">
          {log.map((entry, index) => (
            <div key={index} className="text-[13px]">
              <span className={`font-medium ${entry.role === 'student' ? 'text-accent' : 'text-ink'}`}>
                {entry.speaker}:{' '}
              </span>
              <span className="text-ink-2">{entry.text || '(no audible answer)'}</span>
            </div>
          ))}
        </div>
      </div>

      {recorder.blob && (
        <audio className="w-full mb-6" controls src={URL.createObjectURL(recorder.blob)}>
          <track kind="captions" />
        </audio>
      )}

      <div className="flex items-center">
        <span className="text-[13px] text-ink-3">There's no retake on a baseline assessment.</span>
        <div className="flex-1" />
        <Button
          variant="accent"
          size="lg"
          icon={Icon.arrow}
          onClick={submit}
          disabled={!recorder.blob || isSubmitting}
        >
          {isSubmitting ? 'Submitting…' : 'Submit contribution'}
        </Button>
      </div>
    </div>
  )
}
