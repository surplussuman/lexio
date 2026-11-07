// LLD §21.5 Daily Drill Card + §21.4 Echo's daily message. The low-friction
// way back in on a busy day — two minutes, aimed at the weakest dimension.
import { Link } from 'react-router-dom'

import { useDailyChallenge, useEchoState } from '../lib/retentionApi'
import { Button, EchoMascot, Icon, Pill } from './primitives'

export function DailyDrillCard() {
  const { data: echo } = useEchoState()
  const { data: daily } = useDailyChallenge()

  const challenge = daily?.challenge
  const done = challenge?.status === 'complete'

  return (
    <div className="bg-paper-2 rounded-[10px] p-5 flex gap-4 items-start">
      <EchoMascot size={44} talking={!done} />
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Echo</span>
          {echo?.evolution_stage > 1 && (
            <Pill size="sm">Stage {echo.evolution_stage}</Pill>
          )}
        </div>

        {echo?.daily_message && (
          <p className="text-[14px] text-ink-2 leading-relaxed mb-3">{echo.daily_message}</p>
        )}

        {challenge && (
          <div className="flex items-center gap-3 flex-wrap">
            <Pill tone={done ? 'good' : 'accent'} size="sm">
              {done ? 'Drill done' : `Daily drill · ${challenge.dimension_label}`}
            </Pill>
            {!done && (
              <>
                <span className="font-mono text-[11px] text-ink-4">+{challenge.xp_reward} XP · ~2 min</span>
                <Link to={`/assess/${challenge.mode}`}>
                  <Button size="sm" variant="accent" icon={Icon.arrow}>
                    Start today's drill
                  </Button>
                </Link>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
