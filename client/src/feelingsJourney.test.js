import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import axios from 'axios';
import FeelingComponent from './components/FeelingComponent';

let mockBackendUrl = '';
const mockGetAccessTokenSilently = jest.fn(() => Promise.resolve('stage8-token'));
const mockAuthState = {
  isAuthenticated: true,
  user: { sub: 'auth0|stage8-react-user' },
  getAccessTokenSilently: mockGetAccessTokenSilently,
};

jest.mock('./config', () => ({
  __esModule: true,
  get BASE_API_URL() {
    return mockBackendUrl;
  },
  default: { AUD: 'https://stormy-cliffs-52671.herokuapp.com/api' },
}));

jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => mockAuthState,
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('react-charts', () => {
  const React = require('react');
  return { Chart: () => React.createElement('div', { 'data-stage8-chart': true }) };
});

const waitFor = async (assertion) => {
  let lastError;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
};

describe.each([
  ['Go source', 'https://go-source.test', null],
  ['Deno target', 'https://deno-target.test', []],
])('feelings journey against %s endpoint', (_name, endpoint, emptyBody) => {
  let records;
  let container;

  beforeEach(() => {
    records = [];
    mockBackendUrl = endpoint;
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.clearAllMocks();
    mockGetAccessTokenSilently.mockResolvedValue('stage8-token');
    axios.get.mockImplementation(() =>
      Promise.resolve({ data: records.length ? [...records] : emptyBody })
    );
    axios.post.mockImplementation((_url, body, options) => {
      const saved = {
        ...body,
        userID: options.headers['x-user-id'],
      };
      records.unshift(saved);
      return Promise.resolve({ data: saved });
    });
  });

  afterEach(() => {
    if (container) {
      ReactDOM.unmountComponentAtNode(container);
      container.remove();
    }
  });

  it('saves, refreshes history, renders trends, and survives reload', async () => {
    await act(async () => {
      ReactDOM.render(<FeelingComponent />, container);
    });
    await waitFor(() => {
      expect(container.textContent).toContain('No entries yet');
    });

    await act(async () => {
      container.querySelector('form').dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true,
      }));
    });
    await waitFor(() => {
      expect(container.textContent).toContain('Saved. Your entry is now in history.');
      expect(container.textContent).toContain('1 total check-ins');
      expect(container.textContent).toContain('Mostly Steady');
      expect(container.querySelector('[data-stage8-chart]')).not.toBeNull();
    });

    expect(records).toHaveLength(1);
    expect(axios.post).toHaveBeenCalledWith(
      `${endpoint}/api/feelings`,
      expect.objectContaining({ status: '2' }),
      {
        headers: {
          'x-user-id': 'auth0|stage8-react-user',
          Authorization: 'Bearer stage8-token',
        },
      },
    );

    ReactDOM.unmountComponentAtNode(container);
    await act(async () => {
      ReactDOM.render(<FeelingComponent />, container);
    });
    await waitFor(() => {
      expect(container.textContent).toContain('1 total check-ins');
      expect(container.textContent).toContain('Mostly Steady');
    });
    expect(axios.get.mock.calls.filter(([url]) =>
      url === `${endpoint}/api/feelings`
    ).length).toBeGreaterThanOrEqual(3);
  });
});
