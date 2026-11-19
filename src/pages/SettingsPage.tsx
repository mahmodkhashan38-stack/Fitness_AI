import PlaceholderPage from '@/components/ui/PlaceholderPage'
import { NAV_ITEMS } from '@/constants/navigation'

const page = NAV_ITEMS.settings

function SettingsPage() {
  return <PlaceholderPage title={page.label} description={page.description} icon={page.icon} />
}

export default SettingsPage
