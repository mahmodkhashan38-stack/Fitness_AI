import { Alert } from '@/components/ui'

/** Form-level error and the cold-start hint, announced to screen readers. */
function AuthFormStatus({ message, slow }: { message: string | null; slow: boolean }) {
  return (
    <>
      {message && (
        <Alert variant="danger" live>
          {message}
        </Alert>
      )}
      <p role="status" className="text-body-sm text-foreground-muted empty:hidden">
        {slow ? 'Waking up Fitness AI… The first request after a quiet period can take up to a minute.' : ''}
      </p>
    </>
  )
}

export default AuthFormStatus
