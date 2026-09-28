import React from "react";
import { useAuth0 } from "@auth0/auth0-react";
import { LockClosedIcon } from '@heroicons/react/solid'
import { MOOD_OPTIONS } from '../moodMeta';

const features = [
  { icon: '🧠', label: 'Simple daily check-ins' },
  { icon: '📈', label: 'Patterns over time' },
  { icon: '🏃', label: 'Mood + activity context' },
];

const LoginComponent = () => {
  const { loginWithRedirect } = useAuth0();

  return (
    <div className="st-login">
      <div className="st-login-card">
        <div className="st-login-brand"><span aria-hidden="true">☁️</span> Steady</div>
        <h1 className="st-login-title">A calmer, cleaner way to track how you feel.</h1>
        <p className="st-login-copy">
          Capture your mood, add context, and build a record you can actually learn from.
          Less clutter, more signal.
        </p>

        <div className="st-login-moods" aria-hidden="true">
          {MOOD_OPTIONS.map((mood) => (
            <span key={mood.key} className={`st-blob st-fill-${mood.key}`}>
              <span className="st-blob-emoji">{mood.emoji}</span>
            </span>
          ))}
        </div>

        <ul className="st-login-features">
          {features.map((feature) => (
            <li key={feature.label} className="st-login-feature">
              <span aria-hidden="true">{feature.icon}</span>
              {feature.label}
            </li>
          ))}
        </ul>

        <button
          type="button"
          className="st-primary st-login-button"
          onClick={() => loginWithRedirect()}
        >
          <LockClosedIcon className="st-login-icon" aria-hidden="true" />
          Sign in securely
        </button>
        <p className="st-login-note">
          Your private space for daily emotional check-ins and lightweight reflection.
        </p>
      </div>
    </div>
  )
};

export default LoginComponent;
