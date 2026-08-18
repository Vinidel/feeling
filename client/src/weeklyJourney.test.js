import React from 'react';
import ReactDOM from 'react-dom';
import { act, Simulate } from 'react-dom/test-utils';
import axios from 'axios';
import WeeklyTrackerComponent from './components/WeeklyTrackerComponent';

const mockGetAccessTokenSilently = jest.fn(() => Promise.resolve('stage11-token'));
const mockAuthState = {
  isAuthenticated: true,
  user: { sub: 'auth0|stage11-react-user' },
  getAccessTokenSilently: mockGetAccessTokenSilently,
};

jest.mock('./config', () => ({
  __esModule: true,
  BASE_API_URL: 'https://stage11-target.test',
}));

jest.mock('@auth0/auth0-react', () => ({
  useAuth0: () => mockAuthState,
}));

jest.mock('axios', () => ({
  get: jest.fn(),
  post: jest.fn(),
}));

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

describe('weekly tracker journey against the replacement contract', () => {
  let container;
  let records;

  beforeEach(() => {
    records = new Map();
    container = document.createElement('div');
    document.body.appendChild(container);
    jest.clearAllMocks();
    mockGetAccessTokenSilently.mockResolvedValue('stage11-token');
    axios.get.mockImplementation((_url, options) => Promise.resolve({
      data: {
        ok: true,
        record: records.get(options.params.weekOf) ?? null,
      },
    }));
    axios.post.mockImplementation((_url, body, options) => {
      const saved = {
        ...body,
        userID: options.headers['x-user-id'],
        updatedAt: '2026-08-18T00:00:00.000Z',
      };
      records.set(body.weekOf, saved);
      return Promise.resolve({ data: { ok: true, record: saved } });
    });
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  });

  it('selects a week, saves its complete tracker, and reloads it', async () => {
    await act(async () => {
      ReactDOM.render(<WeeklyTrackerComponent />, container);
    });

    const weekInput = container.querySelector('#weekOf');
    const moodSelect = container.querySelector('select');
    const win = container.querySelector('#win');
    const challenge = container.querySelector('#challenge');
    const nextWeek = container.querySelector('#nextWeek');
    const cardioButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent.includes('2 cardio sessions'));
    const saveButton = Array.from(container.querySelectorAll('button'))
      .find((button) => button.textContent === 'Save weekly tracker');

    await act(async () => {
      Simulate.change(weekInput, { target: { value: '2026-08-17' } });
    });
    await waitFor(() => {
      expect(axios.get).toHaveBeenCalledWith(
        'https://stage11-target.test/api/weekly-tracker',
        expect.objectContaining({ params: { weekOf: '2026-08-17' } }),
      );
    });

    await act(async () => {
      Simulate.change(moodSelect, { target: { value: 'great' } });
      Simulate.change(win, { target: { value: 'Stage 11 synthetic win' } });
      Simulate.change(challenge, {
        target: { value: 'Stage 11 synthetic challenge' },
      });
      Simulate.change(nextWeek, {
        target: { value: 'Stage 11 synthetic focus' },
      });
      Simulate.click(cardioButton);
    });

    await act(async () => {
      saveButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await waitFor(() => {
      expect(container.textContent).toContain('Weekly tracker saved.');
    });

    expect(records.get('2026-08-17')).toEqual(expect.objectContaining({
      weekOf: '2026-08-17',
      mood: 'great',
      trackerVersion: 1,
      userID: 'auth0|stage11-react-user',
      checks: expect.objectContaining({ cardio: true }),
      notes: {
        win: 'Stage 11 synthetic win',
        challenge: 'Stage 11 synthetic challenge',
        nextWeek: 'Stage 11 synthetic focus',
      },
    }));

    ReactDOM.unmountComponentAtNode(container);
    await act(async () => {
      ReactDOM.render(<WeeklyTrackerComponent />, container);
    });
    const reloadedWeek = container.querySelector('#weekOf');
    await act(async () => {
      Simulate.change(reloadedWeek, { target: { value: '2026-08-17' } });
    });
    await waitFor(() => {
      expect(container.querySelector('select').value).toBe('great');
      expect(container.querySelector('#win').value).toBe(
        'Stage 11 synthetic win',
      );
      expect(container.textContent).toContain('17%');
    });
  });
});
