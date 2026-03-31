import React from 'react';
import './App.css';
import TitleComponent from './components/TitleComponent';
import FeelingComponent from './components/FeelingComponent';
import LoginComponent from "./components/LoginComponent";
import { useAuth0 } from "@auth0/auth0-react";
import NavBar from "./components/NavBar";

const App = () => {
  const { isAuthenticated } = useAuth0();

  return (
    <div className="app-shell">
      <TitleComponent />
      <div className="app-gradient" />
      <div className="app-noise" />
      <div className="app-inner">
        {isAuthenticated ? <NavBar /> : null}
        <main className="app-content">
          {isAuthenticated ? <FeelingComponent /> : <LoginComponent />}
        </main>
      </div>
    </div>
  );
}

export default App;
