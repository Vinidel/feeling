const SERVER_DEV_URL = 'http://localhost:8080';
const CLIENT_DEV_URL = 'http://localhost:3000';
export const resolveBaseApiUrl = (origin, configuredUrl) => {
  if (configuredUrl === 'same-origin') {
    return origin;
  }
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }
  return origin === CLIENT_DEV_URL ? SERVER_DEV_URL : origin;
};

const url = resolveBaseApiUrl(
  window.location.origin,
  process.env.REACT_APP_API_URL,
);
export const BASE_API_URL = url
export const CLIENT_ID = "RwwIwjmaGcJUKfSJ4bGFcv81VEOQUJeQ";
export const AUD = "https://stormy-cliffs-52671.herokuapp.com/api";
export const DOMAIN = "dev-vin.au.auth0.com";

export default {
  BASE_API_URL,
  CLIENT_ID,
  AUD,
  DOMAIN,
}
