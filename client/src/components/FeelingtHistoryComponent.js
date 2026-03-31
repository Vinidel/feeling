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

const FeelingHistoryComponent = ({data = [], isFetching}) => {
  const [commentRowToggle, setCommentRowToggle] = useState(null);

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

  const renderContent = () => {
    return (
      <div className="minimal-history-list">
        {sortedFeelings.map((f, i) => {
          const date = moment(new Date(f.createdAt)).format('DD MMM YYYY');
          const status = statusMap[Number.parseInt(f.status, 10)] || statusMap[2];
          const isOpen = commentRowToggle === i;
          const activities = parseActivitiesToArray(f.activities);

          return (
            <div className={`minimal-history-item character-history-item ${status.tone}`} key={`${f.createdAt}-${i}`}>
              <button
                type="button"
                className="minimal-history-button"
                onClick={() => toggle(i)}
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
        No entries yet.
      </div>
    )
  }

  return (
    <div>
      {isFetching ? <SpinnerComponent /> : null}
      {!isFetching && sortedFeelings.length ? renderContent() : null}
      {!isFetching && !sortedFeelings.length ? renderEmpty() : null}
    </div>
  );
}

export default FeelingHistoryComponent;
