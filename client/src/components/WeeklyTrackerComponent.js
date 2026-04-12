import React, { useMemo, useState } from 'react';

const getWeekLabel = () => {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start.toISOString().slice(0, 10);
};

const checklist = [
  '2 cardio sessions',
  '2 strength sessions',
  '1 mobility / rehab session',
  '2 build sessions',
  '1 archery session',
  '1 hunt step',
];

const moodOptions = ['Rough', 'Low', 'Steady', 'Good', 'Great'];

export default function WeeklyTrackerComponent() {
  const [weekOf, setWeekOf] = useState(getWeekLabel());
  const [mood, setMood] = useState('Steady');
  const [checks, setChecks] = useState(
    Object.fromEntries(checklist.map((item) => [item, false]))
  );
  const [fields, setFields] = useState({
    win: '',
    challenge: '',
    nextWeek: '',
  });

  const completion = useMemo(() => {
    const total = checklist.length;
    const done = Object.values(checks).filter(Boolean).length;
    return Math.round((done / total) * 100);
  }, [checks]);

  const toggleCheck = (key) => {
    setChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (key, value) => {
    setFields((prev) => ({ ...prev, [key]: value }));
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
              {moodOptions.map((option) => <option key={option}>{option}</option>)}
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
              key={item}
              type="button"
              className={`tracker-check ${checks[item] ? 'tracker-check-active' : ''}`}
              onClick={() => toggleCheck(item)}
            >
              <span className="tracker-check-box">{checks[item] ? '✓' : ''}</span>
              <span>{item}</span>
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
              value={fields.win}
              onChange={(e) => updateField('win', e.target.value)}
            />
          </div>

          <div>
            <label className="minimal-label" htmlFor="challenge">Main challenge</label>
            <textarea
              id="challenge"
              className="minimal-textarea character-input tracker-textarea tracker-textarea-simple"
              placeholder="What got in the way?"
              value={fields.challenge}
              onChange={(e) => updateField('challenge', e.target.value)}
            />
          </div>

          <div className="tracker-full-width">
            <label className="minimal-label" htmlFor="nextWeek">Next week focus</label>
            <textarea
              id="nextWeek"
              className="minimal-textarea character-input tracker-textarea tracker-textarea-simple"
              placeholder="What matters most next week?"
              value={fields.nextWeek}
              onChange={(e) => updateField('nextWeek', e.target.value)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
