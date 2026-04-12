import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth0 } from '@auth0/auth0-react';
import { BASE_API_URL } from '../config';

const getWeekLabel = () => {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start.toISOString().slice(0, 10);
};

const checklist = [
  { key: 'cardio', label: '2 cardio sessions' },
  { key: 'strength', label: '2 strength sessions' },
  { key: 'mobility', label: '1 mobility / rehab session' },
  { key: 'build', label: '2 build sessions' },
  { key: 'archery', label: '1 archery session' },
  { key: 'hunt', label: '1 hunt step' },
];

const moodOptions = ['rough', 'low', 'steady', 'good', 'great'];

const emptyChecks = {
  cardio: false,
  strength: false,
  mobility: false,
  build: false,
  archery: false,
  hunt: false,
};

const emptyNotes = {
  win: '',
  challenge: '',
  nextWeek: '',
};

export default function WeeklyTrackerComponent() {
  const { user, getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [weekOf, setWeekOf] = useState(getWeekLabel());
  const [mood, setMood] = useState('steady');
  const [checks, setChecks] = useState(emptyChecks);
  const [notes, setNotes] = useState(emptyNotes);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const completion = useMemo(() => {
    const total = checklist.length;
    const done = Object.values(checks).filter(Boolean).length;
    return Math.round((done / total) * 100);
  }, [checks]);

  useEffect(() => {
    const loadWeeklyTracker = async () => {
      if (!isAuthenticated || !user?.sub) {
        return;
      }

      try {
        const token = await getAccessTokenSilently({
          audience: 'https://stormy-cliffs-52671.herokuapp.com/api',
        });

        const response = await axios.get(`${BASE_API_URL}/api/weekly-tracker`, {
          params: { weekOf },
          headers: {
            'x-user-id': user.sub,
            Authorization: `Bearer ${token}`,
          },
        });

        const record = response.data?.record;
        if (!record) {
          setMood('steady');
          setChecks(emptyChecks);
          setNotes(emptyNotes);
          setFeedback({ type: '', message: '' });
          return;
        }

        setMood(record.mood || 'steady');
        setChecks({ ...emptyChecks, ...(record.checks || {}) });
        setNotes({ ...emptyNotes, ...(record.notes || {}) });
        setFeedback({ type: '', message: '' });
      } catch (error) {
        console.log('Error loading weekly tracker', error);
      }
    };

    loadWeeklyTracker();
  }, [BASE_API_URL, getAccessTokenSilently, isAuthenticated, user, weekOf]);

  const toggleCheck = (key) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateNote = (key, value) => {
    setNotes((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!isAuthenticated || !user?.sub) {
      return;
    }

    setIsSaving(true);
    setFeedback({ type: '', message: '' });

    try {
      const token = await getAccessTokenSilently({
        audience: 'https://stormy-cliffs-52671.herokuapp.com/api',
      });

      await axios.post(`${BASE_API_URL}/api/weekly-tracker`, {
        weekOf,
        mood,
        trackerVersion: 1,
        checks,
        notes,
      }, {
        headers: {
          'x-user-id': user.sub,
          Authorization: `Bearer ${token}`,
        },
      });

      setFeedback({ type: 'success', message: 'Weekly tracker saved.' });
    } catch (error) {
      console.log('Error saving weekly tracker', error);
      setFeedback({ type: 'error', message: 'Could not save weekly tracker.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="minimal-layout character-layout">
      <section className="minimal-section panel section-card section-card-character tracker-hero">
        <div className="minimal-section-head tracker-head">
          <div>
            <h2 className="section-title section-title-character">Weekly tracker</h2>
            <p className="section-subtitle section-subtitle-character">
              A quick weekly reset for body, build, and bow / hunt.
            </p>
          </div>
          <div className="tracker-summary">
            <div className="tracker-summary-label">Completion</div>
            <div className="tracker-summary-value">{completion}%</div>
          </div>
        </div>

        <div className="tracker-top-grid tracker-top-grid-simple">
          <div>
            <label className="minimal-label" htmlFor="weekOf">Week of</label>
            <input
              id="weekOf"
              type="date"
              className="minimal-input character-input"
              value={weekOf}
              onChange={(e) => setWeekOf(e.target.value)}
            />
          </div>
          <div>
            <label className="minimal-label">Week overall felt</label>
            <select
              className="minimal-input character-input"
              value={mood}
              onChange={(e) => setMood(e.target.value)}
            >
              {moodOptions.map((option) => <option key={option} value={option}>{option.charAt(0).toUpperCase() + option.slice(1)}</option>)}
            </select>
          </div>
        </div>
      </section>

      <section className="minimal-section panel section-card section-card-character">
        <div className="minimal-section-head">
          <div>
            <h2 className="section-title section-title-character">Weekly checklist</h2>
            <p className="section-subtitle section-subtitle-character">Hit the basics. Don’t overthink it.</p>
          </div>
        </div>

        <div className="tracker-check-grid tracker-check-grid-simple">
          {checklist.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`tracker-check ${checks[item.key] ? 'tracker-check-active' : ''}`}
              onClick={() => toggleCheck(item.key)}
            >
              <span className="tracker-check-box">{checks[item.key] ? '✓' : ''}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="minimal-section panel section-card section-card-character">
        <div className="minimal-section-head">
          <div>
            <h2 className="section-title section-title-character">Short review</h2>
            <p className="section-subtitle section-subtitle-character">Just enough to make next week better.</p>
          </div>
        </div>

        <div className="tracker-text-grid tracker-text-grid-simple">
          <div>
            <label className="minimal-label" htmlFor="win">One win</label>
            <textarea
              id="win"
              className="minimal-textarea character-input tracker-textarea tracker-textarea-simple"
              placeholder="What actually went well?"
              value={notes.win}
              onChange={(e) => updateNote('win', e.target.value)}
            />
          </div>

          <div>
            <label className="minimal-label" htmlFor="challenge">Main challenge</label>
            <textarea
              id="challenge"
              className="minimal-textarea character-input tracker-textarea tracker-textarea-simple"
              placeholder="What got in the way?"
              value={notes.challenge}
              onChange={(e) => updateNote('challenge', e.target.value)}
            />
          </div>

          <div className="tracker-full-width">
            <label className="minimal-label" htmlFor="nextWeek">Next week focus</label>
            <textarea
              id="nextWeek"
              className="minimal-textarea character-input tracker-textarea tracker-textarea-simple"
              placeholder="What matters most next week?"
              value={notes.nextWeek}
              onChange={(e) => updateNote('nextWeek', e.target.value)}
            />
          </div>
        </div>

        <div className="minimal-actions tracker-actions">
          {feedback.message ? (
            <div className={`minimal-feedback ${feedback.type === 'success' ? 'minimal-feedback-success' : 'minimal-feedback-error'}`}>
              {feedback.message}
            </div>
          ) : null}
          <button
            type="button"
            className="minimal-primary-button character-primary-button"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save weekly tracker'}
          </button>
        </div>
      </section>
    </div>
  );
}
