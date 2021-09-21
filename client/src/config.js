const SERVER_DEV_URL = 'http://localhost:3003';
const CLIENT_DEV_URL = 'http://localhost:3000';
const url = window.location.origin === CLIENT_DEV_URL ? SERVER_DEV_URL : window.location.origin;
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
