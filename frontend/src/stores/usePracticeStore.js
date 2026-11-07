// LLD §16.3: usePracticeStore — session, coachingTips, metrics, questionNumber
// / addTip, updateMetrics, nextQuestion. Client state only; the session record
// itself is server state (TanStack Query).
import { create } from 'zustand'

export const usePracticeStore = create((set) => ({
  coachingTips: [],
  metrics: { avg_wpm: 0, filler_count: 0, filler_ratio: 0, pause_count: 0, word_count: 0 },
  questionNumber: 0,
  turns: [],
  status: 'idle', // idle | live | ending | complete | error

  addTip: (tip) => set((state) => ({ coachingTips: [tip, ...state.coachingTips].slice(0, 12) })),
  updateMetrics: (metrics) => set({ metrics }),
  nextQuestion: (question, number) =>
    set((state) => ({
      questionNumber: number,
      turns: [...state.turns, { role: 'echo', text: question }],
    })),
  addStudentTurn: (text) => set((state) => ({ turns: [...state.turns, { role: 'student', text }] })),
  setTurns: (turns) => set({ turns }),
  setStatus: (status) => set({ status }),

  reset: () =>
    set({
      coachingTips: [],
      metrics: { avg_wpm: 0, filler_count: 0, filler_ratio: 0, pause_count: 0, word_count: 0 },
      questionNumber: 0,
      turns: [],
      status: 'idle',
    }),
}))
