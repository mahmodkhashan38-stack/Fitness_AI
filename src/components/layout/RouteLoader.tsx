import Spinner from '@/components/ui/Spinner'

/** Fallback shown while a lazily loaded route is being fetched. */
function RouteLoader() {
  return (
    <div className="flex min-h-[50dvh] items-center justify-center text-accent">
      <Spinner size="lg" label="Loading page" />
    </div>
  )
}

export default RouteLoader
