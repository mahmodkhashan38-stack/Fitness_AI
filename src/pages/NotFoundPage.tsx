import { SearchX } from 'lucide-react'
import { Link } from 'react-router'
import PlaceholderPage from '@/components/ui/PlaceholderPage'
import { ROUTES } from '@/constants/routes'

function NotFoundPage() {
  return (
    <div className="flex flex-col gap-6">
      <PlaceholderPage
        title="Page not found"
        icon={SearchX}
        description="The page you are looking for does not exist."
      />
      <Link
        to={ROUTES.dashboard}
        className="font-medium text-primary-700 underline underline-offset-4 dark:text-primary-400"
      >
        Back to Dashboard
      </Link>
    </div>
  )
}

export default NotFoundPage
