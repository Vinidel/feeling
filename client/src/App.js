import React from 'react';
import './App.css';
import TitleComponent from './components/TitleComponent';
import FeelingComponent from './components/FeelingComponent';
import LoginComponent from "./components/LoginComponent";
import FeelingChartComponent from "./components/FeelingChartComponent";
import { useAuth0 } from "@auth0/auth0-react";
import NavBar from "./components/NavBar";

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
        {isLoggedIn() && <NavBar />}
      <div className="App-content">
        {isLoggedIn() ? renderFeelingComponent() : renderLoginComponent()}
      </div>
    </div>
    );
}

export default App;
