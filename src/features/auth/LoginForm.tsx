import { LogIn } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Input } from '@/components/ui'
import AuthFormStatus from '@/features/auth/AuthFormStatus'
import { EMAIL_PATTERN, useAuthForm } from '@/features/auth/useAuthForm'
import { useAuth } from '@/hooks/useAuth'
import type { AuthFormError } from '@/types/auth'

function LoginForm() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const form = useAuthForm({
    validate: () => {
      const fields: AuthFormError['fields'] = {}
      if (!email.trim()) fields.email = 'Enter your email address.'
      else if (!EMAIL_PATTERN.test(email.trim())) fields.email = 'Enter a valid email address.'
      if (!password) fields.password = 'Enter your password.'
      return fields
    },
    submit: () => login({ email: email.trim(), password }),
  })

  return (
    <form noValidate onSubmit={form.onSubmit} className="flex flex-col gap-5" aria-busy={form.submitting}>
      <AuthFormStatus message={form.error.message} slow={form.slow} />
      <Input
        ref={form.fieldRef('email')}
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        value={email}
        onChange={(event) => {
          setEmail(event.target.value)
          form.clearFieldError('email')
        }}
        error={form.error.fields.email}
      />
      <Input
        ref={form.fieldRef('password')}
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => {
          setPassword(event.target.value)
          form.clearFieldError('password')
        }}
        error={form.error.fields.password}
      />
      <Button type="submit" fullWidth size="lg" loading={form.submitting} loadingText="Logging in…" leftIcon={<LogIn aria-hidden="true" />}>
        Log in
      </Button>
      <p className="text-body-sm text-foreground-muted">
        New to Fitness AI?{' '}
        <Link
          to={form.linkWithRedirect(form.registerPath)}
          className="focus-ring rounded-xs font-semibold text-accent underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </form>
  )
}

export default LoginForm
