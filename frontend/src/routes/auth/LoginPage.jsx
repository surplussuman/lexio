import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate } from 'react-router-dom'
import { z } from 'zod'

import { PublicHeader } from '../../components/PublicHeader'
import { Button } from '../../components/primitives'
import { useLogin } from '../../lib/authApi'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export function LoginPage() {
  const navigate = useNavigate()
  const loginMutation = useLogin()
  const [serverError, setServerError] = useState(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) })

  const onSubmit = async (values) => {
    setServerError(null)
    try {
      await loginMutation.mutateAsync(values)
      navigate('/dashboard')
    } catch (err) {
      setServerError(err.message)
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <PublicHeader />
      <div className="max-w-[420px] mx-auto px-6 py-16">
        <h1 className="font-ser text-4xl font-normal mb-2" style={{ letterSpacing: -0.8 }}>
          Welcome back
        </h1>
        <p className="text-sm text-ink-3 mb-8">Log in to continue your path.</p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Email</span>
            <input {...register('email')} type="email" className="lx-input" autoComplete="email" />
            {errors.email && <span className="text-bad text-xs">{errors.email.message}</span>}
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wide text-ink-4">Password</span>
            <input {...register('password')} type="password" className="lx-input" autoComplete="current-password" />
            {errors.password && <span className="text-bad text-xs">{errors.password.message}</span>}
          </label>

          {serverError && <p className="text-bad text-sm">{serverError}</p>}

          <Button type="submit" variant="accent" size="lg" full disabled={isSubmitting}>
            {isSubmitting ? 'Logging in…' : 'Log in'}
          </Button>
        </form>

        <p className="text-sm text-ink-3 mt-6">
          New to Lexio?{' '}
          <Link to="/register" className="text-accent font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  )
}
