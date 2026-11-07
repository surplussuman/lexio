// LLD §16.2 /reassessment — the launcher. Shows why a reassessment is being
// suggested (§13.1 triggers) and which modes are still outstanding.
import { Link, useNavigate } from 'react-router-dom'

import { AppShell } from '../../components/AppShell'
import { Button, Icon, Pill, Rule } from '../../components/primitives'
import {
  useReassessmentHistory,
  useReassessmentStatus,
  useStartReassessment,
} from '../../lib/reassessmentApi'

const MODE_NAMES = {
  speak: 'Speaking', present: 'Presentation', write: 'Writing', vocab: 'Vocabulary',
  grammar: 'Grammar', read: 'Reading Comprehension', listen: 'Listening', gd: 'Group Discussion',
}

export function ReassessmentPage() {
  const navigate = useNavigate()
  const { data, isLoading } = useReassessmentStatus()
  const { data: historyData } = useReassessmentHistory()
  const startReassessment = useStartReassessment()

  const active = data?.active
  const outstanding = data?.outstanding_modes ?? []
  const completed = (historyData?.results ?? []).filter((r) => r.status === 'complete')

  const handleStart = async () => {
    const result = await startReassessment.mutateAsync()
    if (!result.outstanding_modes?.length) {
      navigate(`/reassessment/${result.reassessment.id}/report`)
    }
  }

  return (
    <AppShell>
      <div className="max-w-[820px] mx-auto px-8 py-10">
        <Pill tone="accent">◎ Reassessment</Pill>
        <h1 className="font-ser text-[40px] font-normal mt-3 mb-2" style={{ letterSpacing: -0.8 }}>
          Show us how far you've come.
        </h1>
        <p className="text-[15px] text-ink-3 max-w-[600px] leading-relaxed mb-7">
          Retake the modes you've already been assessed on. Same format, different prompts — then
          Lexio shows you exactly what moved, and rebuilds your path around what's left.
        </p>

        {isLoading && <p className="text-ink-3 text-sm">Checking your status…</p>}

        {/* Just finished the last mode — send them straight to the report. */}
        {data?.just_completed && (
          <div className="bg-accent-soft border border-accent rounded-[10px] p-6 mb-4">
            <Pill tone="good" size="sm">
              Report ready
            </Pill>
            <h2 className="font-ser text-[26px] font-normal mt-2.5 mb-1" style={{ letterSpacing: -0.4 }}>
              {data.just_completed.overall_before} → {data.just_completed.overall_after} overall
            </h2>
            <p className="text-[13.5px] text-ink-2 mb-4">
              That's every mode redone. Here's what moved.
            </p>
            <Link to={`/reassessment/${data.just_completed.id}/report`}>
              <Button variant="accent" icon={Icon.arrow}>
                See your comparison report
              </Button>
            </Link>
          </div>
        )}

        {!isLoading && !active && !data?.just_completed && (
          <div className="bg-white border border-rule rounded-[10px] p-6">
            {data?.path_complete && (
              <Pill tone="good" size="sm">
                Your path is complete — good time to reassess
              </Pill>
            )}
            {!data?.path_complete && data?.auto_nudge && (
              <Pill tone="accent" size="sm">
                You've practised a lot since your last assessment
              </Pill>
            )}

            <p className="text-[14px] text-ink-2 leading-relaxed mt-3 mb-4">
              {data?.can_request
                ? 'Starting a reassessment snapshots where you stand today, then asks you to redo each mode.'
                : data?.cooldown_message}
            </p>

            <Button
              variant="accent"
              icon={Icon.arrow}
              onClick={handleStart}
              disabled={!data?.can_request || startReassessment.isPending}
            >
              {startReassessment.isPending ? 'Starting…' : 'Start reassessment'}
            </Button>
          </div>
        )}

        {active && (
          <div className="bg-white border border-rule rounded-[10px] p-6">
            <div className="flex items-center gap-2 mb-2">
              <Pill tone="accent" size="sm">
                In progress
              </Pill>
              <span className="font-mono text-[11px] text-ink-4">
                {active.required_modes.length - outstanding.length}/{active.required_modes.length} done
              </span>
            </div>
            <h2 className="font-ser text-[24px] font-normal mb-1">Modes still to redo</h2>
            <p className="text-[13px] text-ink-3 mb-4">
              Finish these and your comparison report unlocks automatically.
            </p>

            <div className="flex flex-col gap-2">
              {outstanding.map((mode) => (
                <Link
                  key={mode}
                  to={`/assess/${mode}?reassessment=1`}
                  className="border border-rule rounded-md px-4 py-3 flex items-center gap-3 hover:border-accent transition-colors"
                >
                  <span className="font-ser text-[17px] flex-1">{MODE_NAMES[mode] ?? mode}</span>
                  <span className="text-accent">{Icon.arrow}</span>
                </Link>
              ))}
              {outstanding.length === 0 && (
                <Link to={`/reassessment/${active.id}/report`}>
                  <Button variant="accent" icon={Icon.arrow}>
                    See your comparison report
                  </Button>
                </Link>
              )}
            </div>
          </div>
        )}

        {completed.length > 0 && (
          <>
            <Rule label="PAST REASSESSMENTS" />
            <div className="flex flex-col gap-2">
              {completed.map((reassessment) => (
                <Link
                  key={reassessment.id}
                  to={`/reassessment/${reassessment.id}/report`}
                  className="bg-white border border-rule rounded-[10px] px-5 py-4 flex items-center gap-4 hover:border-accent transition-colors"
                >
                  <div className="flex-1">
                    <div className="font-ser text-[18px]">
                      {reassessment.overall_before} → {reassessment.overall_after}
                    </div>
                    <div className="font-mono text-[10px] text-ink-4 uppercase tracking-wide mt-0.5">
                      {new Date(reassessment.completed_at).toLocaleDateString()} ·{' '}
                      {reassessment.triggered_by.replace('_', ' ')}
                    </div>
                  </div>
                  <Pill tone={reassessment.overall_delta >= 0 ? 'good' : 'neutral'} size="sm">
                    {reassessment.overall_delta >= 0 ? '▲' : '▼'} {Math.abs(reassessment.overall_delta)}
                  </Pill>
                  <span className="text-accent">{Icon.arrow}</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </AppShell>
  )
}
