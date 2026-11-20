import { ClipboardList, LogOut } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Alert, Button, Card } from '@/components/ui'
import { ROUTES } from '@/constants/routes'
import OnboardingForm from '@/features/account/OnboardingForm'
import { useAuth } from '@/hooks/useAuth'

/**
 * Shown to accounts created before FIT-12 until their fitness profile is complete. Outside the
 * app shell (no fitness navigation), but logging out is always possible.
 */
function OnboardingPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)

  const onLogout = async () => {
    setLogoutError(null)
    setLoggingOut(true)
    try {
      await logout()
      navigate(ROUTES.login, { replace: true })
    } catch {
      setLogoutError('Couldn’t log out. Check your connection and try again.')
      setLoggingOut(false)
    }
  }

  return (
    <Card padding="lg" className="gap-6">
      <div className="flex flex-col gap-3">
        <span className="flex size-12 items-center justify-center rounded-card bg-primary-subtle text-accent" aria-hidden="true">
          <ClipboardList className="size-6" />
        </span>
        <h1 className="text-h2 text-foreground">Complete your profile</h1>
        <p className="text-body text-foreground-muted">
          {user ? `Welcome back, ${user.name}. ` : ''}Fitness AI now tailors your training to you. Tell us a little about
          yourself to continue.
        </p>
      </div>
      <OnboardingForm />
      <div className="flex flex-col items-start gap-2 border-t border-border pt-4">
        {logoutError && (
          <Alert variant="danger" live>
            {logoutError}
          </Alert>
        )}
        <Button variant="ghost" size="sm" leftIcon={<LogOut aria-hidden="true" />} loading={loggingOut} loadingText="Logging out…" onClick={() => void onLogout()}>
          Log out{user ? ` (${user.email})` : ''}
        </Button>
      </div>
    </Card>
  )
}

export default OnboardingPage
