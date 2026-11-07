// LLD §16.2 /profile — profile, settings and badges (M1 §4.4 <ProfileEdit>
// plus M9 §12.5 badges). Not in the design zip; extends the shell/primitive
// conventions.
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { AppShell } from '../../components/AppShell'
import { TopicPicker } from '../../components/TopicPicker'
import { Avatar, Button, Pill, Rule, StreakChip, XPBar } from '../../components/primitives'
import { useLogout, useMe, useUpdateProfile } from '../../lib/authApi'
import { useBadges, useGamificationStatus } from '../../lib/gamificationApi'
import { useAuthStore } from '../../stores/useAuthStore'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  college: z.string().optional(),
  batch_year: z
    .string()
    .optional()
    .transform((value) => (value ? Number(value) : undefined)),
})

export function ProfilePage() {
  const navigate = useNavigate()
  const storedUser = useAuthStore((s) => s.user)
  const { data: freshUser } = useMe()
  const user = freshUser ?? storedUser

  const { data: statusData } = useGamificationStatus()
  const { data: badgeData } = useBadges()
  const updateProfile = useUpdateProfile()
  const logout = useLogout()
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    values: {
      name: user?.name ?? '',
      college: user?.college ?? '',
      batch_year: user?.batch_year ? String(user.batch_year) : '',
    },
  })

  const onSubmit = async (values) => {
    setSaved(false)
    await updateProfile.mutateAsync(values)
    setSaved(true)
  }

  const badges = badgeData?.badges ?? []
  const earnedCount = badges.filter((badge) => badge.earned).length

  return (
    <AppShell>
      <div className="max-w-[900px] mx-auto px-8 py-10">
        <div className="flex items-center gap-4 mb-8">
          <Avatar name={(user?.name || user?.email || '??').slice(0, 2).toUpperCase()} size={56} />
          <div className="flex-1">
            <h1 className="font-ser text-[34px] font-normal leading-tight" style={{ letterSpacing: -0.6 }}>
              {user?.name || 'Your profile'}
            </h1>
            <div className="font-mono text-[11px] text-ink-4 mt-0.5">{user?.email}</div>
          </div>
          <StreakChip days={statusData?.streak_days ?? 0} />
        </div>

        {statusData && (
          <div className="bg-white border border-rule rounded-[10px] p-5 mb-4">
            <XPBar
              xp={statusData.total_xp}
              max={
                statusData.xp_to_next_level
                  ? statusData.total_xp + statusData.xp_to_next_level
                  : statusData.total_xp
              }
              title={`Level ${statusData.level} · ${statusData.level_title}`}
            />
            {statusData.streak_freezes > 0 && (
              <p className="text-[12px] text-ink-3 mt-3">
                You have {statusData.streak_freezes} streak freeze
                {statusData.streak_freezes === 1 ? '' : 's'} — one missed day won't break your streak.
              </p>
            )}
          </div>
        )}

        <Rule label={`BADGES · ${earnedCount}/${badges.length}`} />
        <div className="grid grid-cols-5 gap-3">
          {badges.map((badge) => (
            <div
              key={badge.key}
              title={badge.description}
              className={`border rounded-[10px] p-4 text-center ${
                badge.earned ? 'border-accent bg-accent-soft' : 'border-rule bg-white opacity-50'
              }`}
            >
              <div className="text-2xl mb-1.5 text-accent">{badge.icon || '◦'}</div>
              <div className="font-ser text-[15px] leading-tight">{badge.name}</div>
              <div className="text-[11px] text-ink-4 mt-1 leading-snug">{badge.description}</div>
            </div>
          ))}
        </div>

        <Rule label="PROFILE" />
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-w-[420px]" noValidate>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Name</span>
            <input {...register('name')} className="lx-input" />
            {errors.name && <span className="text-bad text-xs">{errors.name.message}</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">College</span>
            <input {...register('college')} className="lx-input" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Batch year</span>
            <input {...register('batch_year')} type="number" className="lx-input" />
          </label>

          <div className="flex items-center gap-3">
            <Button type="submit" variant="accent" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </Button>
            {saved && <Pill tone="good" size="sm">Saved</Pill>}
          </div>
        </form>

        <Rule label="ASSESSMENT TOPICS" />
        <div className="max-w-[560px]">
          <p className="text-[13.5px] text-ink-3 leading-relaxed mb-4">
            The domains your questions get written around. Change these any time — it takes effect
            on the next assessment or practice session you start.
          </p>
          <TopicPicker compact />
        </div>

        <Rule label="ACCOUNT" />
        <Button
          variant="secondary"
          onClick={async () => {
            await logout.mutateAsync().catch(() => {})
            navigate('/login')
          }}
        >
          Log out
        </Button>
      </div>
    </AppShell>
  )
}
