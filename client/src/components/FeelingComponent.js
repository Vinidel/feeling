import React, { useMemo, useState } from 'react'
import axios from 'axios';
import FeelingtHistoryComponent from './FeelingtHistoryComponent';
import {BASE_API_URL} from '../config';
import {useAuth0} from "@auth0/auth0-react";
import WithFetch from "./WithFetch";
import ActivityGroup from "./ActivityGroup";
import FeelingChartComponent from "./FeelingChartComponent";
import { getMoodByValue, MOOD_OPTIONS } from '../moodMeta';

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
    () => getMoodByValue(state.status),
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
    <div className="st-stack st-journal">
      <section className={`st-card st-checkin st-wash-${selectedMood.key}`}>
        <p className="st-kicker">Today</p>
        <h1 className="st-title">How’s today landing?</h1>
        <p className="st-subtitle">A quick check-in for mood, movement, and context.</p>

        <form className="st-form" onSubmit={handleSubmit}>
          <div>
            <div className="st-blobs" role="group" aria-label="Mood">
              {MOOD_OPTIONS.map((option) => {
                const selected = state.status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`st-blob st-fill-${option.key} ${selected ? 'st-blob-selected' : ''}`}
                    onClick={() => setStatus(option.value)}
                    aria-pressed={selected}
                    aria-label={option.label}
                    title={option.label}
                  >
                    <span className="st-blob-emoji" aria-hidden="true">{option.emoji}</span>
                  </button>
                );
              })}
            </div>
            <p className="st-mood-name" aria-live="polite">
              Feeling <strong>{selectedMood.label.toLowerCase()}</strong>
            </p>
          </div>

          <div>
            <div className="st-label-row">
              <span className="st-label">What did you get up to?</span>
              <span className="st-optional">Optional</span>
            </div>
            <div className="st-chips">
              {Object.entries(state.activities).map(([key, value]) => (
                <ActivityGroup
                  key={key}
                  activity={{id: key, label: key, checked: value}}
                  handleOnChange={setActivity}
                />
              ))}
            </div>
          </div>

          <div className="st-meta-grid">
            <div>
              <label className="st-label" htmlFor="activity-date">Date</label>
              <input
                className="st-input"
                type="date"
                id="activity-date"
                value={state.createdAt}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="st-label" htmlFor="comment">Note</label>
              <textarea
                name="comment"
                placeholder="What influenced your mood today?"
                id="comment"
                className="st-textarea"
                value={state.comment}
                onChange={handleCommentChange}
              />
              <div className="st-helper">
                Optional: one or two lines are enough to make patterns easier to spot later.
              </div>
            </div>
          </div>

          {saveMessage ? <div className="st-feedback st-feedback-success">{saveMessage}</div> : null}
          {saveError ? <div className="st-feedback st-feedback-error">{saveError}</div> : null}

          <button
            className="st-primary"
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? 'Saving…' : 'Save check-in'}
          </button>
        </form>
      </section>

      <section className="st-card">
        <h2 className="st-h2">History and trends</h2>
        <p className="st-subtitle">Last 30 days at a glance, plus your entry history.</p>
        <WithFetch
          myUpdate={update}
          url={`${BASE_API_URL}/api/feelings`}
          render={({data, isFetching}) => (
            <div className="st-history">
              {!isFetching && data.length ? (
                <div className="st-chart-shell">
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
