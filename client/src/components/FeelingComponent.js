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
    <div className="grid gap-6">
      <section className="panel section-card">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-600">Daily check-in</p>
            <h2 className="section-title">How are you feeling today?</h2>
            <p className="section-subtitle">
              Log today’s mood, add a few activities, and leave a note if there’s a story behind it.
            </p>
          </div>
          <div className="rounded-2xl bg-slate-900 px-4 py-3 text-sm text-slate-100 shadow-lg">
            <span className="block text-xs uppercase tracking-[0.25em] text-slate-400">Selected mood</span>
            <span className="mt-1 block text-lg font-semibold">
              {moodOptions.find((option) => option.value === state.status)?.label}
            </span>
          </div>
        </div>

        <form className="mt-8 space-y-8" onSubmit={handleSubmit}>
          <div>
            <label className="mb-4 block text-sm font-semibold text-slate-900">Mood</label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {moodOptions.map((option) => {
                const selected = state.status === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`rounded-3xl border px-4 py-4 text-left transition ${
                      selected
                        ? 'border-sky-500 bg-sky-50 shadow-lg shadow-sky-100'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                    }`}
                    onClick={() => setStatus(option.value)}
                  >
                    <span className="block text-3xl">{option.emoji}</span>
                    <span className="mt-3 block text-sm font-semibold text-slate-900">{option.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-4">
              <label className="block text-sm font-semibold text-slate-900">Activities</label>
              <span className="text-xs text-slate-500">Optional context</span>
            </div>
            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
              {Object.entries(state.activities).map(([key, value]) => (
                <ActivityGroup
                  key={key}
                  activity={{id: key, label: key, checked: value}}
                  handleOnChange={setActivity}
                />
              ))}
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-[220px_1fr]">
            <div>
              <label className="mb-3 block text-sm font-semibold text-slate-900">Date</label>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                type="date"
                id="activity-date"
                value={state.createdAt}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-semibold text-slate-900" htmlFor="comment">Notes</label>
              <textarea
                name="comment"
                placeholder="What’s driving today’s mood?"
                id="comment"
                className="min-h-[140px] w-full resize-y rounded-3xl border border-slate-200 bg-white px-4 py-4 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:ring-4 focus:ring-sky-100"
                value={state.comment}
                onChange={handleCommentChange}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 md:flex-row md:items-center md:justify-between">
            <p className="m-0 text-sm text-slate-500">
              Keep it quick. A sentence or two is enough.
            </p>
            <button
              className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-sky-600/20 transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-70"
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? 'Saving…' : 'Save check-in'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel section-card">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-sky-600">History</p>
          <h2 className="section-title">Recent entries</h2>
          <p className="section-subtitle">Review how your mood has shifted and what was around it.</p>
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
