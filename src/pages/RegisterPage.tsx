import { UserPlus } from 'lucide-react'
import { Link } from 'react-router'
import { Card } from '@/components/ui'
import { ROUTES } from '@/constants/routes'

function RegisterPage() {
  return (
    <Card padding="lg" className="gap-6">
      <div className="flex flex-col gap-3">
        <span className="flex size-12 items-center justify-center rounded-card bg-primary-subtle text-accent" aria-hidden="true">
          <UserPlus className="size-6" />
        </span>
        <h1 className="text-h2 text-foreground">Create account</h1>
        <p className="text-body text-foreground-muted">
          Registration is coming in a future sprint. This page uses the public layout, without app navigation.
        </p>
      </div>
      <p className="text-body-sm text-foreground-muted">
        Already have an account?{' '}
        <Link to={ROUTES.login} className="focus-ring rounded-xs font-semibold text-accent underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </Card>
  )
}

export default RegisterPage
