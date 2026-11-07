// LLD §13.4 /reassessment/:id/report — the before/after comparison. The radar
// chart is the prototype's SkillRadar idea (design_extracted/lexio/
// extensions.jsx) rendered with Recharts so two polygons can overlay.
import { Link, useParams } from 'react-router-dom'
import { Legend, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'

import { AppShell } from '../../components/AppShell'
import { Button, EchoMascot, Icon, Pill, Rule, ScoreRing } from '../../components/primitives'
import { useReassessmentReport } from '../../lib/reassessmentApi'

export function ComparisonReportPage() {
  const { reassessmentId } = useParams()
  const { data, isLoading, error } = useReassessmentReport(reassessmentId)

  if (isLoading) {
    return (
      <AppShell>
        <p className="max-w-[900px] mx-auto px-8 py-16 text-ink-3 text-sm">Building your comparison…</p>
      </AppShell>
    )
  }

  if (error) {
    const outstanding = error.details?.outstanding_modes ?? []
    return (
      <AppShell>
        <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
          <h1 className="font-ser text-3xl font-normal mb-3" style={{ letterSpacing: -0.6 }}>
            Not quite finished.
          </h1>
          <p className="text-ink-3 text-sm mb-2">{error.message}</p>
          {outstanding.length > 0 && (
            <p className="font-mono text-[11px] text-ink-4 uppercase tracking-wide mb-6">
              Still to do: {outstanding.join(', ')}
            </p>
          )}
          <Link to="/reassessment">
            <Button variant="accent" icon={Icon.arrow}>
              Back to reassessment
            </Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const { reassessment, highlights, dimension_labels: labels, new_path_preview: pathPreview } = data
  const improved = reassessment.overall_delta >= 0

  const radarData = Object.keys(reassessment.delta_scores).map((dimension) => ({
    dimension: (labels[dimension] ?? dimension).split(' ')[0],
    before: reassessment.baseline_snapshot[dimension] ?? 0,
    after: reassessment.new_scores[dimension] ?? 0,
  }))

  return (
    <AppShell>
      <div className="max-w-[1100px] mx-auto px-8 py-10">
        <Pill tone={improved ? 'good' : 'accent'}>◎ Comparison report</Pill>
        <h1 className="font-ser text-[42px] font-normal mt-3 mb-6" style={{ letterSpacing: -0.9 }}>
          {improved ? "Here's what changed." : "Here's an honest look at where you are."}
        </h1>

        <div className="grid grid-cols-[340px_1fr] gap-7">
          <aside className="flex flex-col gap-4">
            <div className="bg-white border border-rule rounded-[10px] p-5">
              <div className="flex items-center gap-5">
                <ScoreRing value={reassessment.overall_after} size={104} />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Overall now</div>
                  <div className="font-ser text-[26px] mt-0.5" style={{ letterSpacing: -0.3 }}>
                    {reassessment.overall_before} → {reassessment.overall_after}
                  </div>
                  <Pill tone={improved ? 'good' : 'neutral'} size="sm">
                    {improved ? '▲' : '▼'} {Math.abs(reassessment.overall_delta)} points
                  </Pill>
                </div>
              </div>
            </div>

            {highlights.length > 0 && (
              <div className="bg-white border border-rule rounded-[10px] p-5">
                <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-3">
                  Biggest gains
                </div>
                <div className="flex flex-col gap-2.5">
                  {highlights.map((highlight) => (
                    <div key={highlight.dimension} className="flex items-center gap-3">
                      <span className="font-ser text-[24px] text-good leading-none w-12">
                        +{highlight.delta}
                      </span>
                      <span className="text-[13.5px] text-ink-2">{highlight.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {reassessment.improvement_narrative && (
              <div className="bg-paper-2 rounded-[10px] p-4 flex gap-3 items-start">
                <EchoMascot size={40} />
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mb-1">
                    Echo's read
                  </div>
                  {reassessment.improvement_narrative.split('\n\n').map((paragraph) => (
                    <p key={paragraph.slice(0, 32)} className="text-[13px] leading-relaxed text-ink-2 mb-2 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </aside>

          <main className="flex flex-col gap-5">
            {radarData.length >= 3 && (
              <div className="bg-white border border-rule rounded-[10px] p-6">
                <h2 className="font-ser text-[22px] font-normal mb-3">Before and after</h2>
                <ResponsiveContainer width="100%" height={320}>
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke="var(--color-rule)" />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'var(--color-ink-3)' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-ink-4)' }} />
                    <Radar name="Before" dataKey="before" stroke="var(--color-ink-4)" fill="var(--color-ink-4)" fillOpacity={0.15} />
                    <Radar name="After" dataKey="after" stroke="var(--color-accent)" fill="var(--color-accent)" fillOpacity={0.3} />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="bg-white border border-rule rounded-[10px] p-6">
              <h2 className="font-ser text-[22px] font-normal mb-4">Dimension by dimension</h2>
              <table className="w-full text-[14px]">
                <thead>
                  <tr className="font-mono text-[10px] uppercase tracking-wide text-ink-4">
                    <th className="text-left pb-2 font-normal">Dimension</th>
                    <th className="text-right pb-2 font-normal">Before</th>
                    <th className="text-right pb-2 font-normal">After</th>
                    <th className="text-right pb-2 font-normal">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(reassessment.delta_scores)
                    .sort(([, a], [, b]) => b - a)
                    .map(([dimension, delta]) => (
                      <tr key={dimension} className="border-t border-rule">
                        <td className="py-2.5 text-ink">{labels[dimension] ?? dimension}</td>
                        <td className="py-2.5 text-right font-mono text-ink-3">
                          {reassessment.baseline_snapshot[dimension]}
                        </td>
                        <td className="py-2.5 text-right font-mono text-ink">
                          {reassessment.new_scores[dimension]}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono ${
                            delta > 0 ? 'text-good' : delta < 0 ? 'text-bad' : 'text-ink-4'
                          }`}
                        >
                          {delta > 0 ? '+' : ''}
                          {delta}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {pathPreview?.length > 0 && (
              <div className="bg-white border border-rule rounded-[10px] p-6">
                <h2 className="font-ser text-[22px] font-normal mb-1">Your path, rebuilt</h2>
                <p className="text-[13px] text-ink-3 mb-4">Reordered around what these new scores say.</p>
                <div className="flex flex-col gap-2">
                  {pathPreview.map((module, index) => (
                    <div key={module.id} className="flex items-center gap-3 border border-rule rounded-md px-4 py-3">
                      <span className="font-mono text-[11px] text-ink-4">{String(index + 1).padStart(2, '0')}</span>
                      <span className="font-ser text-[17px] flex-1">{module.title}</span>
                      <span className="font-mono text-[10px] text-ink-4 uppercase tracking-wide">
                        {module.dimension} · {module.estimated_minutes} min
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Rule />
            <div className="flex gap-2.5 items-center">
              <Link to="/dashboard">
                <Button variant="secondary">Back to dashboard</Button>
              </Link>
              <div className="flex-1" />
              <Link to="/path">
                <Button variant="accent" icon={Icon.arrow}>
                  See your new path
                </Button>
              </Link>
            </div>
          </main>
        </div>
      </div>
    </AppShell>
  )
}
