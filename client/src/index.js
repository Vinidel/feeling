import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
import './index.css';
import { Auth0Provider } from "@auth0/auth0-react";
import config from "./config";

const onRedirectCallback = (appState) => {
  console.log("stateIs", appState);
  history.push(
    appState && appState.returnTo ? appState.returnTo : window.location.pathname
  );
};

ReactDOM.render(
  <Auth0Provider
    domain={config.DOMAIN}
    clientId={config.CLIENT_ID}
    redirectUri={window.location.origin}
    audience={config.AUD}
  >
    <App />
  </Auth0Provider>
  ,
  document.getElementById('root')
);
