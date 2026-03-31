import React from 'react'
import { useAuth0 } from "@auth0/auth0-react";

export default function NavBar() {
  const { user, isLoading, logout } = useAuth0();

  if (isLoading) {
    return <div className="panel section-card">Loading...</div>;
  }

  return (
    <header className="panel section-card" style={{ padding: '18px 22px' }}>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-600">Wellness dashboard</div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">
            My.Feelings
          </h1>
          <p className="mt-2 text-sm text-slate-600 md:text-base">
            Track your mood, note what moved it, and spot patterns over time.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start rounded-2xl border border-slate-200 bg-white/70 px-3 py-3 shadow-sm md:self-auto">
          <img
            className="h-11 w-11 rounded-2xl object-cover ring-2 ring-sky-100"
            src={user.picture}
            alt={user.name}
          />
          <div>
            <div className="text-sm font-semibold text-slate-900">{user.name}</div>
            {user.email ? <div className="text-xs text-slate-500">{user.email}</div> : null}
          </div>
          <button
            type="button"
            onClick={() => logout({ returnTo: window.location.origin })}
            className="ml-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
