import { House, SearchX } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/ui'
import PlaceholderPage from '@/components/ui/PlaceholderPage'
import { ROUTES } from '@/constants/routes'

function NotFoundPage() {
  return (
    <PlaceholderPage
      title="Page not found"
      icon={SearchX}
      description="The page you are looking for doesn’t exist or has moved."
    >
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          icon={<SearchX />}
          title="Nothing here"
          description="Check the address, or head back to your Dashboard."
          headingLevel="h2"
          action={
            <Link
              to={ROUTES.dashboard}
              className="focus-ring inline-flex h-11 items-center gap-2 rounded-control border border-primary-edge bg-primary px-4 text-body-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              <House className="size-[1.125rem]" aria-hidden="true" />
              Back to Dashboard
            </Link>
          }
        />
      </div>
    </PlaceholderPage>
  )
}

export default NotFoundPage
