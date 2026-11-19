import LoadingState from '@/components/feedback/LoadingState'

/** Fallback shown while a lazily loaded route is being fetched. */
function RouteLoader() {
  return <LoadingState variant="page" label="Loading page…" />
}

export default RouteLoader
