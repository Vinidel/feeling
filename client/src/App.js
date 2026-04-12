import React from 'react';
import './App.css';
import TitleComponent from './components/TitleComponent';
import FeelingComponent from './components/FeelingComponent';
import LoginComponent from "./components/LoginComponent";
import { useAuth0 } from "@auth0/auth0-react";
import NavBar from "./components/NavBar";
import UIPreviewPage from "./components/UIPreviewPage";

const App = () => {
  const { isAuthenticated } = useAuth0();
  const isPreviewRoute = typeof window !== 'undefined' && window.location.pathname === '/preview';

  return (
    <div className="app-shell">
      {!isPreviewRoute ? <TitleComponent /> : null}
      <div className="app-gradient" />
      <div className="app-noise" />
      <div className="app-inner">
        {!isPreviewRoute && isAuthenticated ? <NavBar /> : null}
        <main className="app-content">
          {isPreviewRoute ? <UIPreviewPage /> : null}
          {!isPreviewRoute && isAuthenticated ? <FeelingComponent /> : null}
          {!isPreviewRoute && !isAuthenticated ? <LoginComponent /> : null}
        </main>
      </div>
    </div>
  );
}

export default App;
