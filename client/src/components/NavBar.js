import React from 'react'
import { useAuth0 } from "@auth0/auth0-react";

const navItems = [
  { key: 'feelings', label: 'Journal', shortLabel: 'Journal', icon: '📖', href: '#feelings' },
  { key: 'weekly-tracker', label: 'Weekly tracker', shortLabel: 'Weekly', icon: '🎯', href: '#weekly-tracker' },
];

export default function NavBar({ activeView = 'feelings' }) {
  const { user, isLoading, logout } = useAuth0();

  if (isLoading) {
    return <div className="st-loading-bar">Loading...</div>;
  }

  return (
    <>
      <header className="st-header">
        <div className="st-brand">
          <span aria-hidden="true">☁️</span>
          <span>Steady</span>
          <span className="st-brand-tag">Mood journal</span>
        </div>

        <nav className="st-topnav" aria-label="Primary">
          {navItems.map((item) => (
            <a
              key={item.key}
              href={item.href}
              className={`st-topnav-link ${activeView === item.key ? 'st-topnav-link-active' : ''}`}
              aria-current={activeView === item.key ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="st-user">
          <img className="st-avatar" src={user.picture} alt={user.name} />
          <span className="st-username">{user.name}</span>
          <button
            type="button"
            onClick={() => logout({ returnTo: window.location.origin })}
            className="st-signout"
          >
            Sign out
          </button>
        </div>
      </header>

      <nav className="st-tabbar" aria-label="Primary mobile">
        {navItems.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className={`st-tab ${activeView === item.key ? 'st-tab-active' : ''}`}
            aria-current={activeView === item.key ? 'page' : undefined}
          >
            <span className="st-tab-icon" aria-hidden="true">{item.icon}</span>
            {item.shortLabel}
          </a>
        ))}
      </nav>
    </>
  )
}
