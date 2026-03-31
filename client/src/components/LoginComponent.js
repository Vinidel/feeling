import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { LockClosedIcon } from '@heroicons/react/solid'

const LoginComponent = () => {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="mx-auto flex min-h-[75vh] max-w-5xl items-center justify-center">
      <div className="panel grid w-full overflow-hidden rounded-[32px] border border-slate-200 shadow-2xl lg:grid-cols-[1.1fr_0.9fr]">
        <div className="bg-slate-950 px-8 py-10 text-white md:px-12 md:py-14">
          <div className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.35em] text-sky-200">
            Mood journal
          </div>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">
            A calmer, cleaner way to track how you feel.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 md:text-lg">
            Capture your mood, add context, and build a record you can actually learn from.
            Less clutter, more signal.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-2xl">🧠</div>
              <div className="mt-2 text-sm font-semibold">Simple daily check-ins</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-2xl">📈</div>
              <div className="mt-2 text-sm font-semibold">Patterns over time</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-2xl">🏃</div>
              <div className="mt-2 text-sm font-semibold">Mood + activity context</div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center bg-white px-8 py-10 md:px-12 md:py-14">
          <div className="w-full max-w-md">
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-sky-600">
              Welcome back
            </div>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              Sign in to My.Feelings
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Your private space for daily emotional check-ins and lightweight reflection.
            </p>
            <button
              type="button"
              className="group mt-8 flex w-full items-center justify-center gap-3 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-offset-2"
              onClick={() => loginWithRedirect()}
            >
              <LockClosedIcon className="h-5 w-5 text-sky-100 transition group-hover:text-white" aria-hidden="true" />
              Sign in securely
            </button>
          </div>
        </div>
      </div>
    </div>
  )
};

export default LoginComponent;
