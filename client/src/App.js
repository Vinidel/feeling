import React from 'react';
import './App.css';
import TitleComponent from './components/TitleComponent';
import FeelingComponent from './components/FeelingComponent';
import LoginComponent from "./components/LoginComponent";
import { useAuth0 } from "@auth0/auth0-react";

const App = () => {
  const { isAuthenticated } = useAuth0();

  const isLoggedIn = () => {
    return isAuthenticated;
  }

  const renderFeelingComponent = () =>
    (
      <FeelingComponent />
    )

 const renderLoginComponent = () => (
    <LoginComponent />
  )

    return (
      <div className="App">
        <TitleComponent />
      <div className="App-content">
        {isLoggedIn() ? renderFeelingComponent() : renderLoginComponent()}
      </div>
    </div>
    );
}

export default App;
