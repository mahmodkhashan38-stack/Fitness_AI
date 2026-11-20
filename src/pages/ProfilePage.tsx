import PlaceholderPage from '@/components/ui/PlaceholderPage'
import { NAV_ITEMS } from '@/constants/navigation'
import FitnessProfileSection from '@/features/account/FitnessProfileSection'

const page = NAV_ITEMS.profile

function ProfilePage() {
  return (
    <PlaceholderPage title={page.label} description={page.description} icon={page.icon}>
      <div className="max-w-2xl">
        <FitnessProfileSection />
      </div>
    </PlaceholderPage>
  )
}

export default ProfilePage
