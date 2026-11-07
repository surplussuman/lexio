// LLD §4.4 <RegisterForm> — /register. Not in the design zip; extends the
// established shell/primitive/typography conventions rather than inventing
// a new style (see CLAUDE.md "Design system rules").
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { PublicHeader } from '../../components/PublicHeader'
import { Button, Wordmark } from '../../components/primitives'
import { useRegister } from '../../lib/authApi'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'At least 8 characters'),
  college: z.string().optional(),
  batch_year: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined)),
})

export function RegisterPage() {
  const navigate = useNavigate()
  const registerMutation = useRegister()
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      await registerMutation.mutateAsync(values)
      navigate('/dashboard')
    } catch (err) {
      setServerError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <PublicHeader />
      <div className="max-w-[420px] mx-auto px-6 py-16">
        <div className="mb-8 md:hidden">
          <Wordmark size={20} />
        </div>
        <h1 className="font-ser text-4xl font-normal mb-2" style={{ letterSpacing: -0.8 }}>
          Start your assessment
        </h1>
        <p className="text-sm text-ink-3 mb-8">Free for students. Takes three minutes.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <Field label="Name" error={errors.name?.message}>
            <input {...register('name')} className="lx-input" autoComplete="name" />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input {...register('email')} type="email" className="lx-input" autoComplete="email" />
          </Field>
          <Field label="Password" error={errors.password?.message}>
            <input {...register('password')} type="password" className="lx-input" autoComplete="new-password" />
          </Field>
          <Field label="College (optional)" error={errors.college?.message}>
            <input {...register('college')} className="lx-input" />
          </Field>
          <Field label="Batch year (optional)" error={errors.batch_year?.message}>
            <input {...register('batch_year')} type="number" className="lx-input" />
          </Field>

          {serverError && <p className="text-bad text-sm">{serverError}</p>}

          <Button type="submit" variant="accent" size="lg" full disabled={isSubmitting}>
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </Button>
        </form>

        <p className="text-sm text-ink-3 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-accent font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">{label}</span>
      {children}
      {error && <span className="text-bad text-xs">{error}</span>}
    </label>
  )
}
