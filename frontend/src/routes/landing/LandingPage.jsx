// Ported from design_extracted/lexio/desktop.jsx `DLanding`. CTAs point at
// /register (a visitor has no session yet, unlike the prototype's persona).
import { Link } from 'react-router-dom'

import { PublicHeader } from '../../components/PublicHeader'
import { EchoMascot, Icon, Pill, Rule, ScoreRing } from '../../components/primitives'

const STEPS = [
  { n: '01', t: 'Speak or write', tag: 'ASSESS', d: 'Answer prompts, roleplay interviews, give impromptu talks. Every format on the exams you care about.' },
  { n: '02', t: 'Get real feedback', tag: 'DIAGNOSE', d: 'We score 8 dimensions — fluency, clarity, grammar, confidence, structure, tone, vocabulary, listening — and show you the tape.' },
  { n: '03', t: 'Learn what you lacked', tag: 'TEACH', d: 'Curated YouTube videos, articles and micro-lessons land in your path — tuned to the exact gap.' },
]

const TESTIMONIALS = [
  { t: 'Weekly scorecard', v: '"I went from 58 to 81 in six weeks."', a: '— Priya R., NIT Warangal' },
  { t: 'Mentor-reviewed', v: '"The annotated transcripts are gold."', a: '— Arjun M., IIM-B' },
]

export function LandingPage() {
  return (
    <div className="bg-paper">
      <PublicHeader />

      {/* Hero */}
      <section className="grid grid-cols-[1.1fr_1fr] gap-12 items-center px-16 py-16 border-b border-rule">
        <div>
          <Pill tone="accent">◎ Beta · for college students</Pill>
          <h1 className="font-ser text-[76px] leading-[0.98] mt-5 mb-4.5 text-ink font-normal" style={{ letterSpacing: -2 }}>
            From your first <em className="italic text-accent">&ldquo;um&rdquo;</em>
            <br />
            to your boardroom voice.
          </h1>
          <p className="text-[17px] leading-[1.55] text-ink-3 max-w-[520px]">
            Lexio listens, scores and <em>teaches</em>. Every session ends with a personalised path of
            videos, articles and drills — picked for the exact thing <em>you</em> need to work on next.
          </p>
          <div className="flex gap-2.5 mt-7 items-center">
            <Link to="/register">
              <button className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent text-white px-6 py-3.5 text-sm font-medium">
                Take a 3-min assessment {Icon.arrow}
              </button>
            </Link>
            <button className="inline-flex items-center gap-2 rounded-full border border-transparent text-ink-2 px-6 py-3.5 text-sm font-medium">
              {Icon.play} Watch demo
            </button>
          </div>
          <div className="flex gap-7 mt-8 pt-6 border-t border-rule">
            {[['14k', 'students'], ['92%', 'report clearer speech'], ['6 min', 'average session']].map(([n, l]) => (
              <div key={l}>
                <div className="font-ser text-[28px] text-ink leading-none">{n}</div>
                <div className="font-mono text-[10px] text-ink-4 uppercase tracking-wide mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative">
          <div className="bg-white rounded-lg border border-rule p-6" style={{ boxShadow: '0 20px 50px rgba(20,20,19,.06), 0 2px 6px rgba(20,20,19,.04)' }}>
            <div className="flex justify-between items-center">
              <Pill>◉ LIVE · Mock interview</Pill>
              <span className="font-mono text-[11px] text-ink-4">01:24</span>
            </div>
            <div className="flex items-start gap-3 mt-4.5">
              <EchoMascot size={40} talking />
              <div className="bg-paper px-3.5 py-3 rounded-[10px] flex-1 text-[13px] text-ink-2 leading-relaxed">
                &ldquo;Tell me about a time you led a team through a difficult project.&rdquo;
              </div>
            </div>
            <div className="mt-4.5 p-3 border border-dashed border-rule-2 rounded bg-paper">
              <span className="font-mono text-[10px] text-ink-4 uppercase tracking-wide">Your response · transcribing</span>
              <p className="text-[13px] leading-relaxed text-ink-2 mt-2">
                So like, um, during my final year project, we had this, you know, tight deadline and
                <span className="bg-annotation-filler rounded-sm px-0.5"> honestly </span>I had to take charge…
              </p>
            </div>
            <Rule label="LIVE COACHING" />
            <div className="flex flex-col gap-1.5">
              {[
                ['Filler word', '"um" used 3× in 20s'],
                ['Pace', 'A touch fast — take a breath'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2.5 px-3 py-2.5 bg-paper rounded-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                  <span className="text-xs font-medium text-ink">{k}</span>
                  <span className="text-xs text-ink-3">{v}</span>
                </div>
              ))}
            </div>
          </div>
          <div
            className="absolute -right-4.5 -bottom-4.5 w-[90px] h-[90px] bg-white rounded-lg border border-rule p-2.5 flex items-center justify-center"
            style={{ transform: 'rotate(-6deg)', boxShadow: '0 10px 30px rgba(20,20,19,.1)' }}
          >
            <ScoreRing value={74} size={68} stroke={5} />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-16 py-16">
        <div className="flex justify-between items-end mb-8">
          <div>
            <Pill>◎ How it works</Pill>
            <h2 className="font-ser text-[46px] mt-3.5 font-normal leading-none" style={{ letterSpacing: -1 }}>
              A loop that gets you <em className="text-accent">actually</em> better.
            </h2>
          </div>
          <p className="max-w-[340px] text-sm text-ink-3 leading-relaxed">
            Most tools stop at a score. Lexio closes the loop by teaching you what the score <em>means</em> and
            exactly how to move it.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-px bg-rule border border-rule">
          {STEPS.map((s) => (
            <div key={s.n} className="bg-paper p-7 min-h-[240px]">
              <div className="flex justify-between">
                <span className="font-mono text-[11px] text-ink-4">{s.n}</span>
                <Pill tone="accent" size="sm">
                  {s.tag}
                </Pill>
              </div>
              <h3 className="font-ser text-[28px] mt-6 mb-2.5 font-normal" style={{ letterSpacing: -0.5 }}>
                {s.t}
              </h3>
              <p className="text-[13.5px] leading-relaxed text-ink-3">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Why Lexio */}
      <section className="px-16 pt-8 pb-16">
        <div className="grid grid-cols-[1.3fr_1fr] gap-8 items-stretch">
          <div className="bg-ink text-paper p-9 rounded-lg relative overflow-hidden">
            <Pill tone="ink" size="sm">
              ◎ NOT JUST A SCORE
            </Pill>
            <h3 className="font-ser text-4xl leading-[1.02] mt-4 mb-2.5 font-normal max-w-[420px]" style={{ letterSpacing: -0.8 }}>
              A full journey — from day one to the job you want.
            </h3>
            <p className="text-sm leading-relaxed max-w-[440px]" style={{ color: '#CFCAC0' }}>
              Score → feedback → curriculum → practice → re-score. Each loop is personal, calibrated to your
              last session, and logged so you can watch the curve move.
            </p>
            <div className="flex gap-2.5 mt-6 flex-wrap">
              {['Personalised path', 'AI coach', 'YouTube curation', 'Mentor review', 'Progress graphs', 'Leaderboard'].map((t) => (
                <span
                  key={t}
                  className="px-3 py-1.5 rounded-full font-mono text-[11px]"
                  style={{ background: 'rgba(255,255,255,0.08)', color: '#F2EEE5', border: '1px solid rgba(255,255,255,0.12)' }}
                >
                  {t}
                </span>
              ))}
            </div>
            <div className="absolute -right-10 -bottom-10 opacity-[0.18]">
              <EchoMascot size={220} />
            </div>
          </div>
          <div className="flex flex-col gap-4">
            {TESTIMONIALS.map((c) => (
              <div key={c.t} className="bg-white border border-rule p-5.5 rounded-lg flex-1 flex flex-col justify-between">
                <Pill size="sm">{c.t}</Pill>
                <p className="font-ser text-[22px] leading-tight mt-3.5 mb-3 text-ink">{c.v}</p>
                <div className="font-mono text-[11px] text-ink-4">{c.a}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="px-16 py-10 border-t border-rule bg-paper-2 flex justify-between items-center">
        <div>
          <h3 className="font-ser text-3xl font-normal" style={{ letterSpacing: -0.6 }}>
            Ready to hear your own voice change?
          </h3>
          <p className="text-ink-3 mt-1 text-sm">Free for students. No card. Takes three minutes.</p>
        </div>
        <Link to="/register">
          <button className="inline-flex items-center gap-2 rounded-full border border-accent bg-accent text-white px-6 py-3.5 text-sm font-medium">
            Start free assessment {Icon.arrow}
          </button>
        </Link>
      </section>
    </div>
  )
}
