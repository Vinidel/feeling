const SERVER_DEV_URL = 'http://localhost:8080';
const CLIENT_DEV_URL = 'http://localhost:3000';
const url = window.location.origin === CLIENT_DEV_URL ? SERVER_DEV_URL : window.location.origin;
export const BASE_API_URL = url
