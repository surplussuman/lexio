// LLD §16.2 /assess/:mode — starts (or resumes) a session and renders the
// mode's interface. Submitting hands off to the background analysis pipeline
// (§5.2, apps/analysis/runner.py) and returns to the hub immediately — the
// student isn't kept staring at a spinner for something that finishes on its
// own either way. The one place this page still polls /status is re-entering
// a mode whose last submission hasn't finished scoring yet (still in flight,
// or a transient failure the backend just retried) — there's nothing to
// record in that case, only a result to wait for.
//
// Two changes from the first cut:
//
// - An assessment you walked away from is still yours. The backend hands the
//   same session and prompt back, and whatever you'd typed or answered comes
//   with it; interfaces autosave as you work. That now extends past a
//   submitted response too: a scoring failure retries against what was
//   already sent, never asking for it again (StartSessionView).
// - Finishing no longer drops you on a report. Baseline reports are held back
//   until all eight modes are done — see apps/analysis/overview.py — so a
//   completed assessment returns you to the hub with one fewer left.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'

import { AppShell } from '../../components/AppShell'
import { Button, EchoMascot, Modal, Pill } from '../../components/primitives'
import {
  useAbandonSession,
  useSaveDraft,
  useSessionStatus,
  useStartSession,
  useSubmitSession,
} from '../../lib/assessmentApi'
import { useIntegrityWatch } from '../../lib/useIntegrityWatch'
import { useLeaveGuard } from '../../lib/useLeaveGuard'
import { useAssessmentGuardStore } from '../../stores/useAssessmentGuardStore'
import { GdInterface } from './interfaces/GdInterface'
import { ListenInterface } from './interfaces/ListenInterface'
import { McqInterface } from './interfaces/McqInterface'
import { PassageInterface } from './interfaces/PassageInterface'
import { PresentInterface } from './interfaces/PresentInterface'
import { TextInterface } from './interfaces/TextInterface'
import { VoiceInterface } from './interfaces/VoiceInterface'

const MODE_NAMES = {
  speak: 'Speaking', present: 'Presentation', write: 'Writing', vocab: 'Vocabulary',
  grammar: 'Grammar', read: 'Reading Comprehension', listen: 'Listening', gd: 'Group Discussion',
}

const DRAFT_DEBOUNCE_MS = 1500

function interfaceFor(mode) {
  if (mode === 'gd') return GdInterface
  if (mode === 'present') return PresentInterface
  if (mode === 'speak') return VoiceInterface
  if (mode === 'write') return TextInterface
  if (mode === 'read') return PassageInterface
  if (mode === 'listen') return ListenInterface
  return McqInterface // vocab, grammar
}

export function AssessPage() {
  const { mode } = useParams()
  const navigate = useNavigate()
  // /assess/:mode?reassessment=1 — the session counts toward the active
  // reassessment cycle rather than the baseline (LLD §13.2).
  const [searchParams] = useSearchParams()
  const isReassessment = searchParams.get('reassessment') === '1'
  const [session, setSession] = useState(null)
  const [submittedId, setSubmittedId] = useState(null)
  const [error, setError] = useState(null)
  // True for the whole time a session is on screen, every mode — not just
  // while something is recording. While true, walking away (browser back,
  // tab close, the header's "All modes" link) is treated as abandoning the
  // assessment, not just navigating.
  const [guardLeave, setGuardLeave] = useState(false)
  const [pendingLeave, setPendingLeave] = useState(null) // null | () => Promise<void>

  const startSession = useStartSession()
  const submitSession = useSubmitSession()
  const saveDraft = useSaveDraft()
  const abandonSession = useAbandonSession()
  const integrity = useIntegrityWatch()
  const { data: statusData } = useSessionStatus(submittedId, { enabled: Boolean(submittedId) })

  const draftTimerRef = useRef(null)
  const setGuardStore = useAssessmentGuardStore((s) => s.setGuard)

  // A ref, not a plain closure, so `requestLeaveTo` below can stay a stable
  // function identity (safe to register once into the global guard store)
  // while still always abandoning whichever session is actually current.
  const abandonAndThenRef = useRef(null)
  abandonAndThenRef.current = (after) => async () => {
    if (session) await abandonSession.mutateAsync(session.id).catch(() => {})
    after()
  }

  // The one place a guarded "leave" ends up, whoever asked for it — the
  // browser back button, this page's own "All modes" link, or a click on
  // AppShell's header nav (see useAssessmentGuardStore) while a session is
  // live. `navigate` from react-router is a stable reference, so this is
  // safe to register once and reuse.
  const requestLeaveTo = useCallback(
    (to) => setPendingLeave(() => abandonAndThenRef.current(() => navigate(to))),
    [navigate]
  )

  useEffect(() => {
    setGuardStore(guardLeave, requestLeaveTo)
    return () => setGuardStore(false, null)
  }, [guardLeave, requestLeaveTo, setGuardStore])

  useLeaveGuard(guardLeave, {
    onBlockedBack: (reallyGoBack) => setPendingLeave(() => abandonAndThenRef.current(reallyGoBack)),
  })

  const requestLeaveToOnboarding = () => (guardLeave ? requestLeaveTo('/onboarding') : navigate('/onboarding'))

  const confirmLeave = async () => {
    const action = pendingLeave
    setPendingLeave(null)
    setGuardLeave(false)
    await action?.()
  }

  // Start a session as soon as the page opens — the student shouldn't have to
  // click twice to begin. mutateAsync is intentionally not in deps: this runs
  // once per mode.
  useEffect(() => {
    let cancelled = false
    setSession(null)
    setSubmittedId(null)
    setError(null)
    setGuardLeave(false)
    setPendingLeave(null)
    startSession
      .mutateAsync({ mode, isBaseline: !isReassessment })
      .then((created) => {
        if (cancelled) return
        if (created.status === 'recording') {
          setSession(created)
          return
        }
        // Already submitted — still being scored, or a previous scoring
        // failure the backend just retried against that same submission
        // (apps/assessments/views.py StartSessionView). Either way there's
        // nothing left to record; wait it out rather than asking again.
        setSubmittedId(created.id)
      })
      .catch((err) => !cancelled && setError(err))
    return () => {
      cancelled = true
      clearTimeout(draftTimerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, isReassessment])

  // The guard applies from the moment a session is actually on screen — for
  // MCQ/text modes that's the whole assessment, there's no separate
  // "recording started" phase to wait for.
  useEffect(() => {
    setGuardLeave(Boolean(session))
  }, [session])

  useEffect(() => {
    if (statusData?.status === 'complete') {
      navigate(isReassessment ? '/reassessment' : '/onboarding')
    }
  }, [statusData, navigate, isReassessment])

  /** Debounced so a fast typist isn't firing a request per keystroke. */
  const handleDraftChange = (draft) => {
    if (!session) return
    clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      saveDraft.mutate({ sessionId: session.id, draft, integritySignals: integrity.snapshot() })
    }, DRAFT_DEBOUNCE_MS)
  }

  const handleSubmit = async (payload) => {
    setError(null)
    clearTimeout(draftTimerRef.current)
    try {
      await submitSession.mutateAsync({
        sessionId: session.id,
        integritySignals: integrity.snapshot(),
        ...payload,
      })
      setGuardLeave(false)
      // Scoring runs in the background from here (apps/analysis/runner.py) —
      // no reason to sit and watch it. Back to the hub immediately; it'll
      // show this mode as still being scored until it's actually done.
      navigate(isReassessment ? '/reassessment' : '/onboarding')
    } catch (err) {
      setError(err)
    }
  }

  if (submittedId) {
    return (
      <AppShell>
        <Analysing failed={statusData?.status === 'failed'} error={statusData?.error} />
      </AppShell>
    )
  }

  if (error?.code === 'already_completed') {
    return (
      <AppShell>
        <AlreadyDone mode={mode} message={error.message} onBack={() => navigate('/onboarding')} />
      </AppShell>
    )
  }

  const Interface = interfaceFor(mode)

  return (
    <AppShell>
      <div className="max-w-[900px] mx-auto px-8 py-12">
        <div className="flex justify-between items-center mb-6">
          <Pill tone="accent">◎ {MODE_NAMES[mode] ?? mode}</Pill>
          <button type="button" onClick={requestLeaveToOnboarding} className="font-mono text-[11px] text-ink-4 uppercase tracking-wide">
            ← All modes
          </button>
        </div>

        {pendingLeave && (
          <Modal onClose={() => setPendingLeave(null)} labelledBy="leave-guard-title" width={460}>
            <div className="p-7">
              <h2 id="leave-guard-title" className="font-ser text-2xl mb-2" style={{ letterSpacing: -0.4 }}>
                Leave now?
              </h2>
              <p className="text-ink-3 text-sm leading-relaxed mb-6">
                Going back mid-assessment isn't allowed once you've started — leaving now fails
                this attempt. You can start it again with a fresh prompt, but this one won't count.
              </p>
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setPendingLeave(null)}>
                  Stay and finish
                </Button>
                <Button variant="danger" onClick={confirmLeave}>
                  Leave anyway
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {error && <p className="text-bad text-sm mb-4">{error.message}</p>}
        {!session && !error && <p className="text-ink-3 text-sm">Generating your Question…</p>}

        {session && (
          <>
            <h1 className="font-ser text-[34px] font-normal leading-tight mb-4" style={{ letterSpacing: -0.6 }}>
              {session.prompt.text}
            </h1>

            {Object.keys(session.draft ?? {}).length > 0 && (
              <div className="bg-accent-soft border border-accent rounded-[10px] px-4 py-2.5 mb-5">
                <span className="font-mono text-[11px] text-accent uppercase tracking-wide">
                  Picked up where you left off
                </span>
              </div>
            )}

            {session.prompt.tips?.length > 0 && (
              <div className="flex gap-3 items-start bg-paper-2 rounded-[10px] p-4 mb-7">
                <EchoMascot size={32} />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-1">Echo's tips</div>
                  <ul className="text-[13px] text-ink-2 leading-relaxed list-disc pl-4">
                    {session.prompt.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <Interface
              session={session}
              draft={session.draft ?? {}}
              onDraftChange={handleDraftChange}
              onSubmit={handleSubmit}
              isSubmitting={submitSession.isPending}
            />
          </>
        )}
      </div>
    </AppShell>
  )
}

function AlreadyDone({ mode, message, onBack }) {
  return (
    <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
      <div className="flex justify-center mb-6">
        <EchoMascot size={64} />
      </div>
      <h1 className="font-ser text-3xl font-normal mb-3" style={{ letterSpacing: -0.6 }}>
        {MODE_NAMES[mode] ?? mode} is already done.
      </h1>
      <p className="text-ink-3 text-sm mb-6 leading-relaxed">{message}</p>
      <Button variant="accent" onClick={onBack}>
        Back to all assessments
      </Button>
    </div>
  )
}

function Analysing({ failed, error }) {
  if (failed) {
    return (
      <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
        <h1 className="font-ser text-3xl font-normal mb-3">That analysis didn't finish.</h1>
        <p className="text-ink-3 text-sm mb-6">{error || 'Something went wrong while scoring your response.'}</p>
        <Button as="a" href="/onboarding" variant="secondary">
          Back to all modes
        </Button>
      </div>
    )
  }
  return (
    <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
      <div className="flex justify-center mb-6">
        <EchoMascot size={72} talking />
      </div>
      <h1 className="font-ser text-3xl font-normal mb-3" style={{ letterSpacing: -0.6 }}>
        Echo is listening back…
      </h1>
      <p className="text-ink-3 text-sm">
        Scoring your response across the rubric and marking up the transcript. Your full report
        unlocks once all eight assessments are done.
      </p>
    </div>
  )
}
