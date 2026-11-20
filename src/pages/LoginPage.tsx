import { LogIn } from 'lucide-react'
import { Card } from '@/components/ui'
import LoginForm from '@/features/auth/LoginForm'

function LoginPage() {
  return (
    <Card padding="lg" className="gap-6">
      <div className="flex flex-col gap-3">
        <span className="flex size-12 items-center justify-center rounded-card bg-primary-subtle text-accent" aria-hidden="true">
          <LogIn className="size-6" />
        </span>
        <h1 className="text-h2 text-foreground">Log in</h1>
        <p className="text-body text-foreground-muted">Welcome back. Log in to continue to Fitness AI.</p>
      </div>
      <LoginForm />
    </Card>
  )
}

export default LoginPage
