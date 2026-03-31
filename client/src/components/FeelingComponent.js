import React, { useState } from 'react'
import axios from 'axios';
import FeelingtHistoryComponent from './FeelingtHistoryComponent';
import {BASE_API_URL} from '../config';
import {useAuth0} from "@auth0/auth0-react";
import WithFetch from "./WithFetch";
import ActivityGroup from "./ActivityGroup";

const moodOptions = [
  { value: 0, emoji: '😔', label: 'Rough' },
  { value: 1, emoji: '🙁', label: 'Low' },
  { value: 2, emoji: '😐', label: 'Steady' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😀', label: 'Great' },
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
  const [state, setState] = useState({
    status: 2,
    createdAt: formatDateInput(),
    comment: '',
    activities: emptyActivities,
  });

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
    } catch (err) {
      console.log('Error', err)
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="minimal-layout">
      <section className="minimal-section panel section-card">
        <div className="minimal-section-head">
          <div>
            <h2 className="section-title">Today</h2>
            <p className="section-subtitle">A simple check-in for mood, movement, and context.</p>
          </div>
        </div>

        <form className="minimal-form" onSubmit={handleSubmit}>
          <div>
            <label className="minimal-label">Mood</label>
            <div className="minimal-mood-grid">
              {moodOptions.map((option) => {
                const selected = state.status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`minimal-mood-card ${selected ? 'minimal-mood-card-selected' : ''}`}
                    onClick={() => setStatus(option.value)}
                  >
                    <span className="minimal-mood-emoji">{option.emoji}</span>
                    <span className="minimal-mood-text">{option.label}</span>
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

          <div className="minimal-meta-grid">
            <div>
              <label className="minimal-label">Date</label>
              <input
                className="minimal-input"
                type="date"
                id="activity-date"
                value={state.createdAt}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="minimal-label" htmlFor="comment">Note</label>
              <textarea
                name="comment"
                placeholder="Add a note"
                id="comment"
                className="minimal-textarea"
                value={state.comment}
                onChange={handleCommentChange}
              />
            </div>
          </div>

          <div className="minimal-actions">
            <button
              className="minimal-primary-button"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </section>

      <section className="minimal-section panel section-card">
        <div className="minimal-section-head">
          <div>
            <h2 className="section-title">History</h2>
            <p className="section-subtitle">Recent entries, kept simple.</p>
          </div>
        </div>
        <WithFetch
          myUpdate={update}
          url={`${BASE_API_URL}/api/feelings`}
          render={({data, isFetching}) => (<FeelingtHistoryComponent data={data} isFetching={isFetching}/>) }
        />
      </section>
    </div>
  );
}

export default FeelingComponent;
