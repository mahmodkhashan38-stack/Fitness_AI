import { Outlet } from 'react-router'

/**
 * Minimal app shell. The desktop sidebar and mobile bottom navigation
 * will be added here in a later task.
 */
function RootLayout() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Outlet />
    </main>
  )
}

export default RootLayout
