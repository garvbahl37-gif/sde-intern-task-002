import { createRootRoute, Link, Outlet } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: Layout,
})

function Layout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <Link to="/" className="wordmark">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
            <path d="M4 11.5 12 5l8 6.5V20H4z" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M12 9v11" stroke="currentColor" strokeWidth="2" />
          </svg>
          Bill Splitter
        </Link>
      </header>
      <main id="main">
        <Outlet />
      </main>
    </>
  )
}
