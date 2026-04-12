import React from 'react'
import { useAuth0 } from "@auth0/auth0-react";

const navItems = [
  { key: 'feelings', label: 'Journal', href: '#feelings' },
  { key: 'weekly-tracker', label: 'Weekly tracker', href: '#weekly-tracker' },
];

export default function NavBar({ activeView = 'feelings' }) {
  const { user, isLoading, logout } = useAuth0();

  if (isLoading) {
    return <div className="panel section-card">Loading...</div>;
  }

  return (
    <header className="app-header-character">
      <div>
        <div className="app-kicker app-kicker-character">Mood journal</div>
        <h1 className="app-title app-title-character">My.Feelings</h1>
        <p className="app-tagline">A softer way to notice how your days are landing.</p>
        <nav className="app-nav-tabs" aria-label="Primary">
          {navItems.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={`app-nav-tab ${activeView === item.key ? 'app-nav-tab-active' : ''}`}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="app-userbar app-userbar-character">
        <img
          className="app-avatar app-avatar-character"
          src={user.picture}
          alt={user.name}
        />
        <div className="app-usertext">
          <div className="app-username">{user.name}</div>
        </div>
        <button
          type="button"
          onClick={() => logout({ returnTo: window.location.origin })}
          className="app-logout app-logout-character"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
