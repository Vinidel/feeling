import React, { useMemo, useState } from 'react'
import moment from 'moment';
import SpinnerComponent from "./SpinnerComponent";
import { getMoodByValue, MOOD_OPTIONS } from '../moodMeta';

const activityMeta = {
  bow: 'Bow',
  lift: 'Lift',
  run: 'Run',
  swim: 'Swim',
  cycle: 'Cycle',
};

const filterMeta = [
  { key: 'all', label: 'All entries' },
  { key: 'noted', label: 'With notes' },
  { key: 'positive', label: 'Good + Great' },
];

const FeelingHistoryComponent = ({data = [], isFetching}) => {
  const [commentRowToggle, setCommentRowToggle] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all');

  const sortedFeelings = useMemo(() => {
    const normalizedData = Array.isArray(data) ? data : [];
    return [...normalizedData].sort((a, b) => (new Date(b.createdAt) - new Date(a.createdAt)));
  }, [data]);

  const toggle = (id) => {
    if (commentRowToggle === id) {
      return setCommentRowToggle(null);
    }
    return setCommentRowToggle(id)
  };

  const parseActivitiesToArray = (activities = {}) => {
    return Object.entries(activities).filter(([, value]) => Boolean(value)).map(([key]) => key);
  }

  const filteredFeelings = useMemo(() => {
    if (activeFilter === 'noted') {
      return sortedFeelings.filter((entry) => Boolean(entry.comment && entry.comment.trim()));
    }

    if (activeFilter === 'positive') {
      return sortedFeelings.filter((entry) => {
        const status = Number.parseInt(entry.status, 10);
        return status >= 3;
      });
    }

    return sortedFeelings;
  }, [activeFilter, sortedFeelings]);

  const moodSummary = useMemo(() => {
    const totals = sortedFeelings.reduce((accumulator, entry) => {
      const status = getMoodByValue(entry.status);
      const key = status.label;
      return {
        ...accumulator,
        [key]: (accumulator[key] || 0) + 1,
      };
    }, {});

    return [...MOOD_OPTIONS]
      .reverse()
      .map((mood) => ({
        label: mood.label,
        value: totals[mood.label] || 0,
        className: `st-fill-${mood.key}`,
      }));
  }, [sortedFeelings]);

  const totalEntries = sortedFeelings.length;

  const renderContent = () => {
    return (
      <div className="st-entries">
        {filteredFeelings.map((f, i) => {
          const date = moment(new Date(f.createdAt)).format('DD MMM YYYY');
          const status = getMoodByValue(f.status);
          const rowId = `${f.createdAt}-${i}`;
          const isOpen = commentRowToggle === rowId;
          const activities = parseActivitiesToArray(f.activities);

          return (
            <div className={`st-entry st-tint-${status.key}`} key={rowId}>
              <button
                type="button"
                className="st-entry-button"
                onClick={() => toggle(rowId)}
                aria-expanded={isOpen}
              >
                <span className="st-entry-emoji" aria-hidden="true">{status.emoji}</span>
                <span className="st-entry-meta">
                  <span className="st-entry-mood">{status.label}</span>
                  <span className="st-entry-date">{date}</span>
                </span>
                {activities.length ? (
                  <span className="st-entry-tags">
                    {activities.map((activity) => (
                      <span className="st-tag" key={activity}>
                        {activityMeta[activity] || activity}
                      </span>
                    ))}
                  </span>
                ) : null}
                <svg xmlns="http://www.w3.org/2000/svg" className={`st-chevron ${isOpen ? 'st-chevron-open' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen ? (
                <div className="st-entry-note">
                  {f.comment ? f.comment : 'No note added.'}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    )
  }

  const renderEmpty = () => {
    return (
      <div className="st-empty">
        No entries yet - your check-ins will show up here.
      </div>
    )
  }

  return (
    <div className="st-history">
      {!isFetching && totalEntries ? (
        <div className="st-summary">
          <div className="st-summary-top">
            <div>
              <div className="st-summary-title">Trend snapshot</div>
              <div className="st-summary-subtitle">{totalEntries} total check-ins</div>
            </div>
            <div className="st-filters">
              {filterMeta.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`st-filter ${activeFilter === filter.key ? 'st-filter-active' : ''}`}
                  onClick={() => setActiveFilter(filter.key)}
                  aria-pressed={activeFilter === filter.key}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="st-bars">
            {moodSummary.map((entry) => {
              const width = totalEntries ? Math.max(6, Math.round((entry.value / totalEntries) * 100)) : 6;
              return (
                <div key={entry.label}>
                  <div className="st-bar-head">
                    <span>{entry.label}</span>
                    <span>{entry.value}</span>
                  </div>
                  <div className="st-bar-track">
                    <div
                      className={`st-bar-fill ${entry.className}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
      {isFetching ? <SpinnerComponent /> : null}
      {!isFetching && filteredFeelings.length ? renderContent() : null}
      {!isFetching && totalEntries > 0 && !filteredFeelings.length ? (
        <div className="st-empty">
          No entries match this filter yet.
        </div>
      ) : null}
      {!isFetching && !totalEntries ? renderEmpty() : null}
    </div>
  );
}

export default FeelingHistoryComponent;
