import React, { useEffect, useState } from 'react';
import './App.css';
import TitleComponent from './components/TitleComponent';
import FeelingComponent from './components/FeelingComponent';
import WeeklyTrackerComponent from './components/WeeklyTrackerComponent';
import LoginComponent from "./components/LoginComponent";
import { useAuth0 } from "@auth0/auth0-react";
import NavBar from "./components/NavBar";

const getViewFromHash = () => {
  const hash = window.location.hash.replace('#', '');
  return hash === 'weekly-tracker' ? 'weekly-tracker' : 'feelings';
};

const App = () => {
  const { isAuthenticated } = useAuth0();
  const [view, setView] = useState(getViewFromHash());

  useEffect(() => {
    const syncView = () => setView(getViewFromHash());
    window.addEventListener('hashchange', syncView);
    return () => window.removeEventListener('hashchange', syncView);
  }, []);

  const renderView = () => {
    if (view === 'weekly-tracker') {
      return <WeeklyTrackerComponent />;
    }

    return <FeelingComponent />;
  };

  return (
    <div className="app-shell">
      <TitleComponent />
      <div className="app-gradient" />
      <div className="app-noise" />
      <div className="app-inner">
        {isAuthenticated ? <NavBar activeView={view} /> : null}
        <main className="app-content">
          {isAuthenticated ? renderView() : <LoginComponent />}
        </main>
      </div>
    </div>
  );
}

export default App;
