// LLD §16.2 /path/module/:id — module detail with its content items and the
// mastery-gated completion action (§22.2).
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { AppShell } from '../../components/AppShell'
import { Button, Icon, Pill, Rule } from '../../components/primitives'
import { useCompleteItem, useCompleteModule, useModule } from '../../lib/pathApi'
import { ResourceCard } from './ResourceCard'

export function ModulePage() {
  const { moduleId } = useParams()
  const { data: module, isLoading, error } = useModule(moduleId)
  const completeItem = useCompleteItem()
  const completeModule = useCompleteModule()
  const [message, setMessage] = useState(null)

  if (isLoading) {
    return (
      <AppShell>
        <p className="max-w-[900px] mx-auto px-8 py-16 text-ink-3 text-sm">Loading module…</p>
      </AppShell>
    )
  }
  if (error) {
    return (
      <AppShell>
        <div className="max-w-[560px] mx-auto px-8 py-24 text-center">
          <h1 className="font-ser text-3xl font-normal mb-3">Couldn't load this module.</h1>
          <p className="text-ink-3 text-sm mb-6">{error.message}</p>
          <Link to="/path">
            <Button variant="secondary">Back to path</Button>
          </Link>
        </div>
      </AppShell>
    )
  }

  const allItemsDone = module.items.every((item) => item.status === 'complete')
  const isComplete = module.status === 'complete'

  const handleCompleteModule = async () => {
    setMessage(null)
    try {
      const result = await completeModule.mutateAsync(moduleId)
      setMessage({ ok: result.completed, text: result.message })
    } catch (err) {
      setMessage({ ok: false, text: err.message })
    }
  }

  return (
    <AppShell>
      <div className="max-w-[900px] mx-auto px-8 py-10">
        <Link to="/path" className="font-mono text-[11px] text-ink-4 uppercase tracking-wide">
          ← Learning path
        </Link>

        <div className="flex items-center gap-2 mt-5 mb-2">
          <Pill tone={isComplete ? 'good' : 'accent'}>{isComplete ? '◎ Mastered' : `◎ ${module.dimension}`}</Pill>
          <span className="font-mono text-[10px] text-ink-4 uppercase tracking-wide">
            {module.estimated_minutes} min · {module.xp_reward} XP
          </span>
        </div>
        <h1 className="font-ser text-[38px] font-normal mb-3" style={{ letterSpacing: -0.8 }}>
          {module.title}
        </h1>
        <p className="text-[15px] text-ink-3 leading-relaxed max-w-[640px]">{module.description}</p>

        <Rule label={`CONTENT · ${module.items.filter((i) => i.status === 'complete').length}/${module.items.length} DONE`} />

        <div className="flex flex-col gap-3">
          {module.items.map((item) => (
            <ResourceCard
              key={item.id}
              item={item}
              onComplete={() => completeItem.mutate(item.id)}
              isCompleting={completeItem.isPending}
            />
          ))}
        </div>

        <div className="mt-8 bg-paper-2 rounded-[10px] p-5">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="font-ser text-[20px]">
                {isComplete ? 'Module mastered' : 'Prove you’ve mastered this'}
              </div>
              <div className="text-[13px] text-ink-3 mt-0.5 leading-snug">
                {isComplete
                  ? 'You finished the content and your score cleared the threshold.'
                  : `Finishing the content isn't enough on its own — your ${module.dimension} score needs to reach ${module.mastery_threshold} in a later session.`}
              </div>
            </div>
            {!isComplete && (
              <Button
                variant="accent"
                icon={Icon.check}
                onClick={handleCompleteModule}
                disabled={!allItemsDone || completeModule.isPending}
              >
                {completeModule.isPending ? 'Checking…' : 'Mark mastered'}
              </Button>
            )}
          </div>
          {message && (
            <p className={`text-[13px] mt-3 ${message.ok ? 'text-good' : 'text-warn'}`}>{message.text}</p>
          )}
        </div>
      </div>
    </AppShell>
  )
}
