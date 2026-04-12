import React, { useMemo, useState } from 'react'
import axios from 'axios';
import FeelingtHistoryComponent from './FeelingtHistoryComponent';
import {BASE_API_URL} from '../config';
import {useAuth0} from "@auth0/auth0-react";
import WithFetch from "./WithFetch";
import ActivityGroup from "./ActivityGroup";
import FeelingChartComponent from "./FeelingChartComponent";

const moodOptions = [
  { value: 0, emoji: '😔', label: 'Rough', tone: 'mood-tone-rough' },
  { value: 1, emoji: '🙁', label: 'Low', tone: 'mood-tone-low' },
  { value: 2, emoji: '😐', label: 'Steady', tone: 'mood-tone-steady' },
  { value: 3, emoji: '🙂', label: 'Good', tone: 'mood-tone-good' },
  { value: 4, emoji: '😀', label: 'Great', tone: 'mood-tone-great' },
];

const emptyActivities = {
  bow: false,
  run: false,
  lift: false,
  swim: false,
  cycle: false,
};

const formatDateInput = (value) => {
  const date = value ? new Date(value) : new Date();
  return date.toISOString().slice(0, 10);
};

const FeelingComponent  = ()  =>{
  const auth = useAuth0();
  const [update, forceUpdate] = useState(0)
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const [state, setState] = useState({
    status: 2,
    createdAt: formatDateInput(),
    comment: '',
    activities: emptyActivities,
  });

  const selectedMood = useMemo(
    () => moodOptions.find((option) => option.value === state.status) || moodOptions[2],
    [state.status]
  );

  const setStatus = (status) => {
    setState((prevState) => ({
      ...prevState,
      status,
    }))
  }

  const setDate = (date) => {
    setState((prevState) => ({
      ...prevState,
      createdAt: date || formatDateInput(),
    }))
  }

  const setActivity = (value, activityName) => {
    setState((prevState) => ({
      ...prevState,
      activities: {
        ...prevState.activities,
        [activityName]: value,
      }
    }))
  }

  const handleCommentChange = (event) => {
    const { value } = event.target;
    setState((prevState) => ({
      ...prevState,
      comment: value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveMessage('');
    setSaveError('');

    try {
      const token = await auth.getAccessTokenSilently({
        audience: "https://stormy-cliffs-52671.herokuapp.com/api",
      });

      await axios.post(`${BASE_API_URL}/api/feelings`,
        {
          status: state.status.toString(),
          createdAt: new Date(state.createdAt).toISOString(),
          comment: state.comment,
          activities: state.activities,
        }, {
          headers: {
            "x-user-id": auth.user.sub,
            Authorization: `Bearer ${token}`,
          }
        });

      setState({
        status: 2,
        createdAt: formatDateInput(),
        comment: '',
        activities: emptyActivities,
      });
      forceUpdate(n => n+1);
      setSaveMessage('Saved. Your entry is now in history.');
    } catch (err) {
      console.log('Error', err)
      setSaveError('Could not save your check-in. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="minimal-layout character-layout">
      <section className="minimal-section panel section-card section-card-character">
        <div className="minimal-section-head">
          <div>
            <h2 className="section-title section-title-character">Today</h2>
            <p className="section-subtitle section-subtitle-character">A quick check-in for mood, movement, and context.</p>
          </div>
        </div>

        <form className="minimal-form" onSubmit={handleSubmit}>
          <div>
            <label className="minimal-label">Mood</label>
            <div className="minimal-selected-mood">
              Selected: <span className="minimal-selected-mood-value">{selectedMood.emoji} {selectedMood.label}</span>
            </div>
            <div className="minimal-mood-grid">
              {moodOptions.map((option) => {
                const selected = state.status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`minimal-mood-card character-mood-card ${option.tone} ${selected ? 'minimal-mood-card-selected character-mood-card-selected' : ''}`}
                    onClick={() => setStatus(option.value)}
                    aria-pressed={selected}
                  >
                    <span className="minimal-mood-emoji character-mood-emoji">{option.emoji}</span>
                    <span className="minimal-mood-text character-mood-text">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="minimal-row-head">
              <label className="minimal-label">Activities</label>
              <span className="minimal-muted">Optional</span>
            </div>
            <div className="minimal-activity-grid">
              {Object.entries(state.activities).map(([key, value]) => (
                <ActivityGroup
                  key={key}
                  activity={{id: key, label: key, checked: value}}
                  handleOnChange={setActivity}
                />
              ))}
            </div>
          </div>

          <div className="minimal-meta-grid feeling-meta-grid">
            <div className="feeling-meta-field">
              <label className="minimal-label">Date</label>
              <input
                className="minimal-input character-input"
                type="date"
                id="activity-date"
                value={state.createdAt}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="feeling-meta-field feeling-note-field">
              <label className="minimal-label" htmlFor="comment">Note</label>
              <textarea
                name="comment"
                placeholder="What influenced your mood today?"
                id="comment"
                className="minimal-textarea character-input feeling-note-textarea"
                value={state.comment}
                onChange={handleCommentChange}
              />
              <div className="minimal-helper-text">
                Optional: one or two lines are enough to make patterns easier to spot later.
              </div>
            </div>
          </div>

          {saveMessage ? <div className="minimal-feedback minimal-feedback-success">{saveMessage}</div> : null}
          {saveError ? <div className="minimal-feedback minimal-feedback-error">{saveError}</div> : null}

          <div className="minimal-actions">
            <button
              className="minimal-primary-button character-primary-button"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </section>

      <section className="minimal-section panel section-card section-card-character">
        <div className="minimal-section-head">
          <div>
            <h2 className="section-title section-title-character">History and trends</h2>
            <p className="section-subtitle section-subtitle-character">Recent entries plus a quick trend overview.</p>
          </div>
        </div>
        <WithFetch
          myUpdate={update}
          url={`${BASE_API_URL}/api/feelings`}
          render={({data, isFetching}) => (
            <div className="minimal-history-stack">
              {!isFetching && data.length ? (
                <div className="minimal-chart-shell">
                  <FeelingChartComponent feelingHistory={data} />
                </div>
              ) : null}
              <FeelingtHistoryComponent data={data} isFetching={isFetching}/>
            </div>
          ) }
        />
      </section>
    </div>
  );
}

export default FeelingComponent;
