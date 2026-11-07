// Shown once per login, before the student reaches their assessments.
//
// There is no proctoring here and there deliberately won't be: no tab
// policing, no webcam lock, nothing that treats a learner like a suspect.
// Someone who wants to paste a chatbot's answer can. What this modal does is
// make the cost of that visible — an assessment answered by someone else
// measures someone else — and ask for a commitment instead of enforcing one.
// The authenticity read on each report (apps/analysis/authenticity.py) is the
// same idea after the fact, and never changes a score either.
import { useEffect, useState } from 'react'

import { Button, EchoMascot, Modal } from './primitives'

const STORAGE_KEY = 'lexio:pledge'

/** One acceptance per browser session — re-asked on the next login, not on
 *  every page view. sessionStorage can throw in locked-down browsers. */
function alreadyAccepted() {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === 'accepted'
  } catch {
    return false
  }
}

function remember() {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, 'accepted')
  } catch {
    /* private mode — the pledge just shows again, which is harmless */
  }
}

export function useIntegrityPledge() {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => setIsOpen(!alreadyAccepted()), [])

  return {
    isOpen,
    accept: () => {
      remember()
      setIsOpen(false)
    },
  }
}

export function IntegrityPledge({ name, onAccept }) {
  const firstName = (name || '').trim().split(' ')[0]

  return (
    <Modal labelledBy="pledge-title" width={600}>
      <div className="p-9">
        <div className="flex items-center gap-3 mb-6">
          <EchoMascot size={44} talking />
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-4">
            Before you start
          </div>
        </div>

        <h2 id="pledge-title" className="font-ser text-[30px] leading-[1.15] mb-5" style={{ letterSpacing: -0.6 }}>
          {firstName ? `${firstName}, this one` : 'This one'} is <em className="text-accent">yours</em>.
        </h2>

        <div className="text-[14.5px] text-ink-2 leading-[1.7] space-y-3.5">
          <p>
            No one is marking you. No one else sees this. There is no pass, no fail, and no
            ranking that follows you anywhere. What happens in the next few minutes exists for
            exactly one person, and you're reading this.
          </p>
          <p>
            Which means the only way to waste it is to make it look good. A perfect score that
            isn't yours tells you nothing, and quietly aims everything that comes after — your
            path, your drills, your practice — at a student who doesn't exist.
          </p>
          <p className="text-ink font-medium">
            Say the clumsy version. Lose your thread and find it again. Let the pauses happen.
            Rough is workable — we can do a great deal with rough. Polished and borrowed gives
            us nothing to work with at all.
          </p>
          <p>
            You're not here to prove anything to us. You're here because six months from now
            you want to walk into a room and say the thing you actually mean. That starts with
            an honest picture of where you're standing today.
          </p>
        </div>

        <div className="mt-7 pt-6 border-t border-rule flex items-center gap-4">
          <p className="font-mono text-[11px] text-ink-4 leading-relaxed flex-1">
            We don't lock your tabs or watch your camera. We just ask.
          </p>
          <Button variant="accent" size="lg" onClick={onAccept}>
            I'm doing this for me
          </Button>
        </div>
      </div>
    </Modal>
  )
}
