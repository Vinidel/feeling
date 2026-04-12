import React, { useMemo, useState } from 'react'
import moment from 'moment';
import SpinnerComponent from "./SpinnerComponent";

const statusMap = {
  0: { emoji: '😔', label: 'Rough', tone: 'history-tone-rough' },
  1: { emoji: '🙁', label: 'Low', tone: 'history-tone-low' },
  2: { emoji: '😐', label: 'Steady', tone: 'history-tone-steady' },
  3: { emoji: '🙂', label: 'Good', tone: 'history-tone-good' },
  4: { emoji: '😀', label: 'Great', tone: 'history-tone-great' },
};

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
      const status = statusMap[Number.parseInt(entry.status, 10)] || statusMap[2];
      const key = status.label;
      return {
        ...accumulator,
        [key]: (accumulator[key] || 0) + 1,
      };
    }, {});

    return [
      { label: 'Great', value: totals.Great || 0, className: 'history-trend-tone-great' },
      { label: 'Good', value: totals.Good || 0, className: 'history-trend-tone-good' },
      { label: 'Steady', value: totals.Steady || 0, className: 'history-trend-tone-steady' },
      { label: 'Low', value: totals.Low || 0, className: 'history-trend-tone-low' },
      { label: 'Rough', value: totals.Rough || 0, className: 'history-trend-tone-rough' },
    ];
  }, [sortedFeelings]);

  const totalEntries = sortedFeelings.length;

  const renderContent = () => {
    return (
      <div className="minimal-history-list">
        {filteredFeelings.map((f, i) => {
          const date = moment(new Date(f.createdAt)).format('DD MMM YYYY');
          const status = statusMap[Number.parseInt(f.status, 10)] || statusMap[2];
          const rowId = `${f.createdAt}-${i}`;
          const isOpen = commentRowToggle === rowId;
          const activities = parseActivitiesToArray(f.activities);

          return (
            <div className={`minimal-history-item character-history-item ${status.tone}`} key={rowId}>
              <button
                type="button"
                className="minimal-history-button"
                onClick={() => toggle(rowId)}
              >
                <div className="minimal-history-main">
                  <span className="minimal-history-emoji character-history-emoji">{status.emoji}</span>
                  <div>
                    <div className="minimal-history-title">{status.label}</div>
                    <div className="minimal-history-date">{date}</div>
                  </div>
                </div>

                <div className="minimal-history-side">
                  {activities.length ? (
                    <div className="minimal-history-tags">
                      {activities.map((activity) => (
                        <span className="minimal-tag character-tag" key={activity}>
                          {activityMeta[activity] || activity}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <span className={`minimal-history-chevron ${isOpen ? 'minimal-history-chevron-open' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </span>
                </div>
              </button>

              {isOpen ? (
                <div className="minimal-history-note character-history-note">
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
      <div className="minimal-empty-state character-empty-state">
        No entries yet - your check-ins will show up here.
      </div>
    )
  }

  return (
    <div className="history-stack">
      {!isFetching && totalEntries ? (
        <div className="history-summary-card">
          <div className="history-summary-top">
            <div>
              <div className="history-summary-title">Trend snapshot</div>
              <div className="history-summary-subtitle">{totalEntries} total check-ins</div>
            </div>
            <div className="history-filter-group">
              {filterMeta.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`history-filter-chip ${activeFilter === filter.key ? 'history-filter-chip-active' : ''}`}
                  onClick={() => setActiveFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <div className="history-summary-bars">
            {moodSummary.map((entry) => {
              const width = totalEntries ? Math.max(6, Math.round((entry.value / totalEntries) * 100)) : 6;
              return (
                <div key={entry.label} className="history-summary-row">
                  <div className="history-summary-row-head">
                    <span>{entry.label}</span>
                    <span>{entry.value}</span>
                  </div>
                  <div className="history-trend-track">
                    <div
                      className={`history-trend-fill ${entry.className}`}
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
        <div className="minimal-empty-state character-empty-state">
          No entries match this filter yet.
        </div>
      ) : null}
      {!isFetching && !totalEntries ? renderEmpty() : null}
    </div>
  );
}

export default FeelingHistoryComponent;
