import { LogIn } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '@/components/ui'
import { ROUTES } from '@/constants/routes'

function LoginPage() {
  return (
    <Card padding="lg" className="gap-6">
      <div className="flex flex-col gap-3">
        <span className="flex size-12 items-center justify-center rounded-card bg-primary-subtle text-accent" aria-hidden="true">
          <LogIn className="size-6" />
        </span>
        <h1 className="text-h2 text-foreground">Log in</h1>
        <p className="text-body text-foreground-muted">
          Sign-in is coming in a future sprint. This page uses the public layout, without app navigation.
        </p>
      </div>
      <p className="text-body-sm text-foreground-muted">
        New to Fitness AI?{' '}
        <Link to={ROUTES.register} className="focus-ring rounded-xs font-semibold text-accent underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </Card>
  )
}

export default LoginPage
