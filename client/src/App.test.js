import React from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import App from './App';

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ isAuthenticated: false }),
}));

it('renders without issuing the retired ping request', () => {
  const div = document.createElement('div');
  ReactDOM.render(<App />, div);
  expect(axios.get).not.toHaveBeenCalled();
});
