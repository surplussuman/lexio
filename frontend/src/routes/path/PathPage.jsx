// LLD §16.2 /path — the module track. Layout follows the prototype's DPath
// (design_extracted/lexio/desktop2.jsx).
import { Link } from 'react-router-dom'

import { AppShell } from '../../components/AppShell'
import { Button, Icon, Pill } from '../../components/primitives'
import { usePath } from '../../lib/pathApi'

const STATUS_STYLE = {
  locked: { tone: 'neutral', label: 'Locked' },
  available: { tone: 'accent', label: 'Ready' },
  in_progress: { tone: 'accent', label: 'In progress' },
  complete: { tone: 'good', label: 'Mastered' },
}

export function PathPage() {
  const { data, isLoading, error } = usePath()

  if (isLoading) {
    return (
      <AppShell>
        <p className="max-w-[900px] mx-auto px-8 py-16 text-ink-3 text-sm">Building your path…</p>
      </AppShell>
    )
  }

  if (error || !data?.path) {
    return (
      <AppShell>
        <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
          <h1 className="font-ser text-3xl font-normal mb-3" style={{ letterSpacing: -0.6 }}>
            Your path isn't ready yet.
          </h1>
          <p className="text-ink-3 text-sm mb-6">
            {error ? error.message : data?.message || 'Complete an assessment and Lexio will build one.'}
          </p>
          <Link to="/onboarding">
            <Button variant="accent" icon={Icon.arrow}>
              Take an assessment
            </Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const { path } = data

  return (
    <AppShell>
      <div className="max-w-[900px] mx-auto px-8 py-10">
        <div className="flex justify-between items-end mb-6">
          <div>
            <Pill tone="accent">◎ Your learning path</Pill>
            <h1 className="font-ser text-[40px] font-normal mt-3" style={{ letterSpacing: -0.8 }}>
              Built from your weakest dimensions.
            </h1>
          </div>
          <div className="text-right">
            <div className="font-ser text-[40px] leading-none">
              {path.completed_modules}
              <span className="text-ink-4 text-[24px]">/{path.total_modules}</span>
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-ink-4 mt-1">Modules mastered</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {path.modules.map((module, index) => {
            const style = STATUS_STYLE[module.status] ?? STATUS_STYLE.locked
            const locked = module.status === 'locked'
            const card = (
              <div
                className={`bg-white border rounded-[10px] p-5 flex items-center gap-5 ${
                  locked ? 'border-rule opacity-60' : 'border-rule hover:border-accent transition-colors'
                }`}
              >
                <span className="font-mono text-[11px] text-ink-4 w-6">{String(index + 1).padStart(2, '0')}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-ser text-[20px]" style={{ letterSpacing: -0.2 }}>
                      {module.title}
                    </span>
                    <Pill tone={style.tone} size="sm">
                      {style.label}
                    </Pill>
                  </div>
                  <p className="text-[13px] text-ink-3 leading-snug">{module.description}</p>
                  <div className="flex gap-4 items-center mt-2">
                    <span className="font-mono text-[10px] text-ink-4 uppercase tracking-wide">
                      {module.dimension} · {module.estimated_minutes} min · {module.xp_reward} XP
                    </span>
                  </div>
                  {module.progress_pct > 0 && (
                    <div className="h-1 bg-rule rounded mt-2.5 overflow-hidden">
                      <div className="h-full bg-accent rounded" style={{ width: `${module.progress_pct}%` }} />
                    </div>
                  )}
                </div>
                {!locked && <span className="text-accent">{Icon.arrow}</span>}
              </div>
            )

            return locked ? (
              <div key={module.id} title="Master the previous module to unlock this one">
                {card}
              </div>
            ) : (
              <Link key={module.id} to={`/path/module/${module.id}`}>
                {card}
              </Link>
            )
          })}
        </div>
      </div>
    </AppShell>
  )
}
