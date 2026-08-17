import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import axios from 'axios';
import FeelingComponent from './components/FeelingComponent';
import WeeklyTrackerComponent from './components/WeeklyTrackerComponent';
import config, { BASE_API_URL } from './config';

const mockGetAccessTokenSilently = jest.fn();
const mockAuthState = {
  isAuthenticated: true,
  user: { sub: 'auth0|characterization-user-a' },
  getAccessTokenSilently: mockGetAccessTokenSilently,
};

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => mockAuthState,
}));

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('existing React API contract', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.clearAllMocks();
    mockGetAccessTokenSilently.mockResolvedValue('synthetic-access-token');
    axios.get.mockImplementation((url) => {
      if (url.endsWith('/api/weekly-tracker')) {
        return Promise.resolve({ data: { ok: true, record: null } });
      }
      return Promise.resolve({ data: [] });
    });
    axios.post.mockResolvedValue({ data: {} });
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  });

  it('loads and saves feelings with the current Auth0 headers and payload shape', async () => {
    await act(async () => {
      ReactDOM.render(<FeelingComponent />, container);
      await flushPromises();
    });

    expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({ audience: config.AUD });
    expect(axios.get).toHaveBeenCalledWith(`${BASE_API_URL}/api/feelings`, {
      headers: {
        'x-user-id': mockAuthState.user.sub,
        Authorization: 'Bearer synthetic-access-token',
      },
    });

    await act(async () => {
      container.querySelector('form').dispatchEvent(new Event('submit', {
        bubbles: true,
        cancelable: true,
      }));
      await flushPromises();
    });

    expect(axios.post).toHaveBeenCalledWith(
      `${BASE_API_URL}/api/feelings`,
      expect.objectContaining({
        status: '2',
        createdAt: expect.any(String),
        comment: '',
        activities: {
          bow: false,
          run: false,
          lift: false,
          swim: false,
          cycle: false,
        },
      }),
      {
        headers: {
          'x-user-id': mockAuthState.user.sub,
          Authorization: 'Bearer synthetic-access-token',
        },
      },
    );
  });

  it('loads and saves weekly trackers with the current Auth0 headers and payload shape', async () => {
    await act(async () => {
      ReactDOM.render(<WeeklyTrackerComponent />, container);
      await flushPromises();
    });

    expect(mockGetAccessTokenSilently).toHaveBeenCalledWith({ audience: config.AUD });
    expect(axios.get).toHaveBeenCalledWith(
      `${BASE_API_URL}/api/weekly-tracker`,
      expect.objectContaining({
        params: { weekOf: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) },
        headers: {
          'x-user-id': mockAuthState.user.sub,
          Authorization: 'Bearer synthetic-access-token',
        },
      }),
    );

    const saveButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Save weekly tracker');

    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await flushPromises();
    });

    expect(axios.post).toHaveBeenCalledWith(
      `${BASE_API_URL}/api/weekly-tracker`,
      expect.objectContaining({
        weekOf: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        mood: 'steady',
        trackerVersion: 1,
        checks: {
          cardio: false,
          strength: false,
          mobility: false,
          build: false,
          archery: false,
          hunt: false,
        },
        notes: {
          win: '',
          challenge: '',
          nextWeek: '',
        },
      }),
      {
        headers: {
          'x-user-id': mockAuthState.user.sub,
          Authorization: 'Bearer synthetic-access-token',
        },
      },
    );
  });
});
