import React from 'react'
import { useAuth0 } from "@auth0/auth0-react";

export default function NavBar() {
  const { user, isLoading, logout } = useAuth0();

  if (isLoading) {
    return <div className="panel section-card">Loading...</div>;
  }

  return (
    <header className="app-header-minimal">
      <div>
        <div className="app-kicker">Mood journal</div>
        <h1 className="app-title">My.Feelings</h1>
      </div>

      <div className="app-userbar">
        <img
          className="app-avatar"
          src={user.picture}
          alt={user.name}
        />
        <div className="app-usertext">
          <div className="app-username">{user.name}</div>
        </div>
        <button
          type="button"
          onClick={() => logout({ returnTo: window.location.origin })}
          className="app-logout"
        >
          Sign out
        </button>
      </div>
    </header>
  )
}
