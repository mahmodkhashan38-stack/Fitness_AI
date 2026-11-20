import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Input } from '@/components/ui'
import AuthFormStatus from '@/features/auth/AuthFormStatus'
import { EMAIL_PATTERN, NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, useAuthForm } from '@/features/auth/useAuthForm'
import { useAuth } from '@/hooks/useAuth'
import type { AuthFormError } from '@/types/auth'

function RegisterForm() {
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const form = useAuthForm({
    validate: () => {
      const fields: AuthFormError['fields'] = {}
      const trimmedName = name.trim()
      if (!trimmedName) fields.name = 'Enter your name.'
      else if (trimmedName.length > NAME_MAX_LENGTH) fields.name = `Use at most ${NAME_MAX_LENGTH} characters.`
      if (!email.trim()) fields.email = 'Enter your email address.'
      else if (!EMAIL_PATTERN.test(email.trim())) fields.email = 'Enter a valid email address.'
      // Same rule as the server, which counts characters after NFKC normalisation.
      const passwordLength = password.normalize('NFKC').length
      if (!password) fields.password = 'Create a password.'
      else if (passwordLength < PASSWORD_MIN_LENGTH) fields.password = `Use at least ${PASSWORD_MIN_LENGTH} characters.`
      else if (passwordLength > PASSWORD_MAX_LENGTH) fields.password = `Use at most ${PASSWORD_MAX_LENGTH} characters.`
      else if (password.trim().toLowerCase() === email.trim().toLowerCase()) fields.password = 'Your password can’t be your email address.'
      return fields
    },
    submit: () => register({ name: name.trim(), email: email.trim(), password }),
  })

  return (
    <form noValidate onSubmit={form.onSubmit} className="flex flex-col gap-5" aria-busy={form.submitting}>
      <AuthFormStatus message={form.error.message} slow={form.slow} />
      <Input
        ref={form.fieldRef('name')}
        label="Name"
        name="name"
        autoComplete="name"
        required
        maxLength={NAME_MAX_LENGTH}
        value={name}
        onChange={(event) => {
          setName(event.target.value)
          form.clearFieldError('name')
        }}
        error={form.error.fields.name}
      />
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
        error={
          form.error.fields.email ? (
            <>
              {form.error.fields.email}{' '}
              {form.error.fields.email.includes('already exists') && (
                <Link to={form.linkWithRedirect(form.loginPath)} className="font-semibold underline underline-offset-4">
                  Go to log in
                </Link>
              )}
            </>
          ) : undefined
        }
      />
      <Input
        ref={form.fieldRef('password')}
        label="Password"
        type="password"
        name="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        maxLength={PASSWORD_MAX_LENGTH}
        helperText={`At least ${PASSWORD_MIN_LENGTH} characters. A few random words make a strong, memorable password.`}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value)
          form.clearFieldError('password')
        }}
        error={form.error.fields.password}
      />
      <Button type="submit" fullWidth size="lg" loading={form.submitting} loadingText="Creating account…" leftIcon={<UserPlus aria-hidden="true" />}>
        Create account
      </Button>
      <p className="text-body-sm text-foreground-muted">
        Already have an account?{' '}
        <Link
          to={form.linkWithRedirect(form.loginPath)}
          className="focus-ring rounded-xs font-semibold text-accent underline-offset-4 hover:underline"
        >
          Log in
        </Link>
      </p>
    </form>
  )
}

export default RegisterForm
