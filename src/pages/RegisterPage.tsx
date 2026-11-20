import { UserPlus } from 'lucide-react'
import { Card } from '@/components/ui'
import RegisterForm from '@/features/auth/RegisterForm'

function RegisterPage() {
  return (
    <Card padding="lg" className="gap-6">
      <div className="flex flex-col gap-3">
        <span className="flex size-12 items-center justify-center rounded-card bg-primary-subtle text-accent" aria-hidden="true">
          <UserPlus className="size-6" />
        </span>
        <h1 className="text-h2 text-foreground">Create account</h1>
        <p className="text-body text-foreground-muted">Create your Fitness AI account to get started.</p>
      </div>
      <RegisterForm />
    </Card>
  )
}

export default RegisterPage
