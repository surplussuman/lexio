// LLD §16.2 /onboarding — the baseline assessment hub. Card grid follows
// the prototype's ModeCard pattern (design_extracted/lexio/extensions.jsx).
//
// Each mode is now one of three things: not started, in progress (pick it back
// up where you left it), or done. Done is final for the baseline — reports
// unlock when all eight are, not one at a time.
import { Link } from 'react-router-dom'

import { AppShell } from '../../components/AppShell'
import { Button, EchoMascot, Icon, Pill, Rule } from '../../components/primitives'
import { useModes } from '../../lib/assessmentApi'

const MODE_ICONS = {
  speak: '🎙', present: '📊', write: '✍', vocab: '📖',
  grammar: '🔍', read: '📄', listen: '🎧', gd: '👥',
}

const MODE_BLURBS = {
  speak: 'Answer a prompt out loud. We score pace, fillers and structure.',
  present: 'Present a deck you’ve never seen — on camera, slide by slide.',
  write: 'A timed written response, scored on grammar and argument.',
  vocab: 'Questions on word choice and precision.',
  grammar: 'Spot the correct sentence — quick calls, no partial credit.',
  read: 'Read a passage, then answer comprehension questions.',
  listen: 'Listen to a short briefing and answer on what you heard.',
  gd: 'Join a group discussion with AI peers and make your case.',
}

export function OnboardingPage() {
  const { data, isLoading, error } = useModes()
  const modes = data?.modes ?? []
  const completed = data?.modes_completed ?? 0
  const total = modes.length || 8
  const isComplete = Boolean(data?.baseline_complete)
  const remaining = total - completed

  return (
    <AppShell>
      <div className="max-w-[1000px] mx-auto px-8 py-12">
        <div className="flex justify-between items-center mb-4">
          <Pill tone="accent">◎ Baseline Assessment</Pill>
          <span className="font-mono text-[11px] text-ink-3">
            {completed} of {total} complete
          </span>
        </div>
        <div className="h-[3px] bg-rule rounded overflow-hidden mb-7">
          <div
            className={`h-full transition-all ${isComplete ? 'bg-good' : 'bg-accent'}`}
            style={{ width: `${(completed / total) * 100}%` }}
          />
        </div>

        {isComplete ? (
          <div className="bg-paper-2 border border-rule rounded-xl p-7 mb-8 flex gap-5 items-start">
            <EchoMascot size={52} talking />
            <div className="flex-1">
              <h1 className="font-ser text-[32px] font-normal leading-tight mb-2" style={{ letterSpacing: -0.7 }}>
                That's all eight. Your reports are <em className="text-accent">open</em>.
              </h1>
              <p className="text-[14px] text-ink-2 leading-relaxed mb-4">
                The overview first — it's the only place the pattern across modes shows up — then
                each assessment in detail underneath it.
              </p>
              <Link to="/report">
                <Button variant="accent" size="lg" icon={Icon.arrow}>
                  Open my baseline report
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <>
            <h1 className="font-ser text-[44px] font-normal leading-tight mb-4" style={{ letterSpacing: -0.8 }}>
              Let's find out where you <em className="text-accent">actually</em> stand.
            </h1>
            <p className="text-[15px] text-ink-3 max-w-[640px] leading-relaxed mb-3">
              Eight short assessments, one per communication mode. Do them in any order, and stop
              whenever you like — we'll keep your place. Each one is answered once.
            </p>
            <p className="text-[14px] text-ink-2 max-w-[640px] leading-relaxed mb-8">
              Your reports open when all eight are done.{' '}
              {completed > 0 && (
                <span className="text-ink">
                  {remaining} to go — nothing is scored back to you until then.
                </span>
              )}
            </p>
          </>
        )}

        {isLoading && <p className="text-ink-3 text-sm">Loading modes…</p>}
        {error && <p className="text-bad text-sm">Couldn't load assessment modes: {error.message}</p>}

        <div className="grid grid-cols-2 gap-3">
          {modes.map((mode) => {
            const card = (
              <>
                <span
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${
                    mode.completed ? 'bg-paper-2' : 'bg-accent-soft'
                  }`}
                >
                  {mode.completed ? '✓' : MODE_ICONS[mode.id]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-ser text-[19px]" style={{ letterSpacing: -0.2 }}>
                      {mode.name}
                    </span>
                    {mode.completed && (
                      <Pill tone="good" size="sm">
                        Done
                      </Pill>
                    )}
                    {mode.in_progress && (
                      <Pill tone="warn" size="sm">
                        In progress
                      </Pill>
                    )}
                    {mode.scoring && (
                      <Pill tone="accent" size="sm">
                        Scoring…
                      </Pill>
                    )}
                  </div>
                  <div className="text-[12.5px] text-ink-3 leading-snug mt-0.5">
                    {mode.completed
                      ? isComplete
                        ? 'Report ready — open it from your baseline report.'
                        : 'Answered. Your report opens once all eight are done.'
                      : mode.scoring
                        ? "You've answered — Echo is still scoring it in the background."
                        : MODE_BLURBS[mode.id]}
                  </div>
                  <div className="font-mono text-[10px] text-ink-4 mt-1.5">
                    {mode.completed ? 'COMPLETE' : `${mode.duration_minutes} MIN`}
                  </div>
                </div>
                {!mode.completed && <span className="text-accent">{Icon.arrow}</span>}
              </>
            )

            // A completed baseline mode isn't a link anywhere: the backend
            // refuses to restart it, so offering the click would only lead to
            // a dead end.
            return mode.completed ? (
              <div
                key={mode.id}
                className="bg-paper-2 border border-rule rounded-[10px] p-5 flex items-center gap-4 opacity-70"
              >
                {card}
              </div>
            ) : (
              <Link
                key={mode.id}
                to={`/assess/${mode.id}`}
                className="bg-white border border-rule rounded-[10px] p-5 flex items-center gap-4 hover:border-accent transition-colors"
              >
                {card}
              </Link>
            )
          })}
        </div>

        <Rule label="WHAT LEXIO ANALYSES · 8 DIMENSIONS" />
        <div className="grid grid-cols-4 gap-2">
          {[
            ['Fluency', 'pace & flow'],
            ['Clarity', 'pronunciation'],
            ['Grammar', 'accuracy'],
            ['Structure', 'thought order'],
            ['Tone', 'warmth & empathy'],
            ['Confidence', 'delivery'],
            ['Vocabulary', 'range & precision'],
            ['Listening', 'comprehension'],
          ].map(([name, detail]) => (
            <div key={name} className="border border-rule rounded-md p-3 bg-white">
              <div className="text-[13px] font-semibold text-ink">{name}</div>
              <div className="text-[10.5px] text-ink-4 mt-0.5">{detail}</div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
