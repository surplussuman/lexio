import { useMutation, useQuery } from '@tanstack/react-query'

import { api } from './api'

export function useModes() {
  return useQuery({ queryKey: ['assessment', 'modes'], queryFn: () => api.get('/assessment/modes') })
}

export function useStartSession() {
  return useMutation({
    mutationFn: ({ mode, level, isBaseline = true }) =>
      api.post('/assessment/start', { mode, level, is_baseline: isBaseline }).then((d) => d.session),
  })
}

/**
 * Autosaves work in progress. Failures are swallowed on purpose: a dropped
 * autosave must never interrupt someone mid-answer, and the next tick retries.
 */
export function useSaveDraft() {
  return useMutation({
    mutationFn: ({ sessionId, draft, integritySignals }) =>
      api
        .post('/assessment/draft', {
          session_id: sessionId,
          draft,
          ...(integritySignals ? { integrity_signals: integritySignals } : {}),
        })
        .catch(() => null),
  })
}

/** The on-the-spot follow-up round after the last slide (Presentation only) —
 * called while recording is still running, so a failure here must never
 * throw in a way that blocks finishing; callers treat an empty/errored
 * result the same as "no follow-ups this time". */
export function useGenerateDoubts() {
  return useMutation({
    mutationFn: ({ sessionId, slideTimings }) =>
      api.post('/assessment/present/doubts', { session_id: sessionId, slide_timings: slideTimings }),
  })
}

/** The next line in a live Group Discussion room — a peer continuing their
 * own point, reacting to what the student just said, or (event
 * "idle_nudge") calling on a student who hasn't spoken yet. Called
 * repeatedly through the room session; a null `turn` just means that beat
 * stays quiet. */
export function useGdTurn() {
  return useMutation({
    mutationFn: ({ sessionId, history, event }) =>
      api.post('/assessment/gd/turn', { session_id: sessionId, history, event }),
  })
}

/** Confirms a session the student chose to walk away from mid-take — see
 * lib/useLeaveGuard. Fails the session server-side rather than leaving it
 * open to quietly resume. */
export function useAbandonSession() {
  return useMutation({
    mutationFn: (sessionId) => api.post('/assessment/abandon', { session_id: sessionId }),
  })
}

export function useSubmitSession() {
  return useMutation({
    mutationFn: ({
      sessionId, audioBlob, text, answers, durationSeconds,
      slideTimings, visualMetrics, doubtQuestions, discussionLog, integritySignals,
    }) => {
      if (audioBlob) {
        const form = new FormData()
        form.append('session_id', sessionId)
        form.append('audio', audioBlob, 'response.webm')
        if (durationSeconds != null) form.append('duration_seconds', String(durationSeconds))
        // Multipart can only carry strings; the serializer decodes these.
        if (slideTimings) form.append('slide_timings', JSON.stringify(slideTimings))
        if (visualMetrics) form.append('visual_metrics', JSON.stringify(visualMetrics))
        if (doubtQuestions?.length) form.append('doubt_questions', JSON.stringify(doubtQuestions))
        if (discussionLog?.length) form.append('discussion_log', JSON.stringify(discussionLog))
        if (integritySignals) form.append('integrity_signals', JSON.stringify(integritySignals))
        return api.postForm('/assessment/submit', form)
      }
      return api.post('/assessment/submit', {
        session_id: sessionId,
        ...(text != null ? { text } : {}),
        ...(answers != null ? { answers } : {}),
        ...(durationSeconds != null ? { duration_seconds: durationSeconds } : {}),
        ...(integritySignals ? { integrity_signals: integritySignals } : {}),
      })
    },
  })
}

/** The overview across all eight modes — locked until the baseline is done. */
export function useBaselineReport() {
  return useQuery({ queryKey: ['assessment', 'report'], queryFn: () => api.get('/assessment/report') })
}

/** Polls /status while the AI analysis runs (LLD §5.2). */
export function useSessionStatus(sessionId, { enabled }) {
  return useQuery({
    queryKey: ['assessment', 'status', sessionId],
    queryFn: () => api.get(`/assessment/${sessionId}/status`),
    enabled: Boolean(sessionId) && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'complete' || status === 'failed' ? false : 2000
    },
  })
}

export function useFeedback(sessionId) {
  return useQuery({
    queryKey: ['feedback', sessionId],
    queryFn: () => api.get(`/feedback/${sessionId}`),
    enabled: Boolean(sessionId),
  })
}

export function useHistory() {
  return useQuery({ queryKey: ['assessment', 'history'], queryFn: () => api.get('/assessment/history') })
}
