import React, { useMemo, useState } from 'react'
import moment from 'moment';
import SpinnerComponent from "./SpinnerComponent";

const statusMap = {
  0: { emoji: '😔', label: 'Rough', tone: 'bg-rose-50 text-rose-700 border-rose-200' },
  1: { emoji: '🙁', label: 'Low', tone: 'bg-orange-50 text-orange-700 border-orange-200' },
  2: { emoji: '😐', label: 'Steady', tone: 'bg-slate-100 text-slate-700 border-slate-200' },
  3: { emoji: '🙂', label: 'Good', tone: 'bg-sky-50 text-sky-700 border-sky-200' },
  4: { emoji: '😀', label: 'Great', tone: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const activityClassMap =  {
  bow: "bg-amber-100 text-amber-700 border-amber-200",
  lift: "bg-yellow-100 text-yellow-700 border-yellow-200",
  run: "bg-lime-100 text-lime-700 border-lime-200",
  swim: "bg-cyan-100 text-cyan-700 border-cyan-200",
  cycle: "bg-indigo-100 text-indigo-700 border-indigo-200",
}

const activityMeta = {
  bow: '🏹 Bow',
  lift: '🏋️ Lift',
  run: '🏃 Run',
  swim: '🏊 Swim',
  cycle: '🚴 Cycle',
};

const FeelingHistoryComponent = ({data = [], isFetching}) => {
  const [commentRowToggle, setCommentRowToggle] = useState(null);

  const sortedFeelings = useMemo(
    () => [...data].sort((a, b) => (new Date(b.createdAt) - new Date(a.createdAt))),
    [data]
  );

  const toggle = (id) => {
    if (commentRowToggle === id) {
      return setCommentRowToggle(null);
    }
    return setCommentRowToggle(id)
  };

  const parseActivitiesToArray = (activities = {}) => {
    return Object.entries(activities).filter(([, value]) => Boolean(value)).map(([key]) => key);
  }

  const stats = useMemo(() => {
    if (!sortedFeelings.length) {
      return [];
    }

    const recent = sortedFeelings.slice(0, 7);
    const average = recent.reduce((sum, item) => sum + Number.parseInt(item.status, 10), 0) / recent.length;
    const noteCount = recent.filter((item) => item.comment && item.comment.trim().length).length;
    const activityCount = recent.reduce((sum, item) => sum + parseActivitiesToArray(item.activities).length, 0);

    return [
      { label: 'Last 7 average', value: `${average.toFixed(1)}/4` },
      { label: 'Entries with notes', value: `${noteCount}` },
      { label: 'Tagged activities', value: `${activityCount}` },
    ];
  }, [sortedFeelings]);

  const renderTableContent = () => {
    return (
      <div className="space-y-4">
        {stats.length ? (
          <div className="grid gap-3 md:grid-cols-3">
            {stats.map((item) => (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-4" key={item.label}>
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{item.label}</div>
                <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{item.value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {sortedFeelings.map((f, i) => {
          const date = moment(new Date(f.createdAt)).format('DD MMM YYYY');
          const timeAgo = moment(new Date(f.createdAt)).fromNow();
          const status = statusMap[Number.parseInt(f.status, 10)] || statusMap[2];
          const isOpen = commentRowToggle === i;
          const activities = parseActivitiesToArray(f.activities);

          return (
            <div
              className="history-card"
              key={`${f.createdAt}-${i}`}
            >
              <button
                type="button"
                className="flex w-full flex-col gap-4 px-5 py-5 text-left md:flex-row md:items-center md:justify-between"
                onClick={() => toggle(i)}
              >
                <div className="flex items-center gap-4">
                  <div className="history-emoji-wrap">
                    <span>{status.emoji}</span>
                  </div>
                  <div>
                    <div className="text-base font-semibold text-slate-900">{status.label}</div>
                    <div className="mt-1 text-sm text-slate-500">{date} · {timeAgo}</div>
                  </div>
                </div>

                <div className="flex flex-1 flex-wrap items-center justify-start gap-2 md:justify-end">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${status.tone}`}>
                    Mood
                  </span>
                  {activities.length ? activities.map((activity) => (
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${activityClassMap[activity] || 'bg-slate-100 text-slate-700 border-slate-200'}`} key={activity}>
                      {activityMeta[activity] || activity}
                    </span>
                  )) : (
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                      No activity tagged
                    </span>
                  )}
                  <span className={`ml-auto text-slate-400 transition md:ml-2 ${isOpen ? 'rotate-180' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </button>

              {isOpen ? (
                <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4 text-sm leading-7 text-slate-600">
                  {f.comment ? f.comment : 'No note added for this entry.'}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  }

  const renderEmptyTable = () => {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center text-slate-500">
        No entries yet. Your first check-in will show up here.
      </div>
    )
  }

  const renderSpinner = () => (<SpinnerComponent />)

  return (
    <div>
      {isFetching ? renderSpinner() : ''}
      <br/>
      {sortedFeelings.length && !isFetching ? renderTableContent() : renderEmptyTable() }
    </div>
  );
}

export default FeelingHistoryComponent;
