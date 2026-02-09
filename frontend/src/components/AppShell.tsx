import { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderClock, Home, Users } from 'lucide-react'

interface AppShellProps {
  title: string
  children: ReactNode
  backTo?: string
}

export default function AppShell({ title, children, backTo }: AppShellProps) {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { to: '/', label: '桌面', icon: Home },
    { to: '/history', label: '历史', icon: FolderClock },
    { to: '/roles', label: '角色', icon: Users },
  ]

  return (
    <div className="apple-desktop">
      <div className="apple-window">
        <aside className="apple-sidebar">
          <div className="apple-sidebar-title">Macintosh HD</div>
          <nav className="apple-nav">
            {navItems.map((item) => {
              const Icon = item.icon
              const active =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to)
              return (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => navigate(item.to)}
                  className={`apple-nav-item ${active ? 'apple-nav-item-active' : ''}`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </nav>
        </aside>

        <main className="apple-main">
          <header className="apple-header">
            <div className="apple-lights">
              <span className="apple-light apple-light-red" />
              <span className="apple-light apple-light-yellow" />
              <span className="apple-light apple-light-green" />
            </div>
            <h1 className="apple-title">{title}</h1>
            {backTo ? (
              <button type="button" onClick={() => navigate(backTo)} className="apple-back-btn">
                <ArrowLeft className="h-4 w-4" />
                返回
              </button>
            ) : (
              <div />
            )}
          </header>
          <section className="apple-content">{children}</section>
        </main>
      </div>
    </div>
  )
}
