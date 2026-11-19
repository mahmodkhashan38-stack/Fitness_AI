import PlaceholderPage from '@/components/ui/PlaceholderPage'
import { NAV_ITEMS } from '@/constants/navigation'

const page = NAV_ITEMS.workouts

function WorkoutsPage() {
  return <PlaceholderPage title={page.label} description={page.description} icon={page.icon} />
}

export default WorkoutsPage
