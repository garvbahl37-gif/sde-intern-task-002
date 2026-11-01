import '@fontsource-variable/bricolage-grotesque'
import '@fontsource-variable/instrument-sans'
import './styles.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, Link, RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ApiError } from './api'
import { EmptyState, ErrorState } from './components/states'
import { routeTree } from './routeTree.gen'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 4xx answer will not change if asked again, so show it at once. Other failures
      // (offline, timeout, 5xx) get one more try before the page shows an error.
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return failureCount < 1
      },
      staleTime: 5_000,
    },
  },
})

const router = createRouter({
  routeTree,
  // If anything throws while rendering, show a message instead of a blank page.
  defaultErrorComponent: ({ error, reset }) => (
    <div className="page page--narrow">
      <ErrorState title="This page hit a problem" error={error} onRetry={reset} />
    </div>
  ),
  defaultNotFoundComponent: () => (
    <div className="page page--narrow">
      <EmptyState title="Nothing here">
        This address does not match a page. <Link to="/">Go to the start page</Link>
      </EmptyState>
    </div>
  ),
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('root element missing')

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
