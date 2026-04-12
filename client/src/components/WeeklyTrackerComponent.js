import React, { useMemo, useState } from 'react';

const getWeekLabel = () => {
  const now = new Date();
  const start = new Date(now);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start.toISOString().slice(0, 10);
};

const checkboxGroups = {
  body: [
    'Cardio session 1',
    'Cardio session 2',
    'Strength session 1',
    'Strength session 2',
    'Mobility / rehab session',
  ],
  build: [
    'Build session 1',
    'Build session 2',
  ],
  bow: [
    'Archery practice session',
    'Hunting research / outreach step',
  ],
  review: [
    'Moved enough this week',
    'Built something real instead of just thinking',
    'Moved closer to the hunt',
    'Drifting into overthinking / abstraction',
  ],
};

const emptyChecks = Object.fromEntries(
  Object.entries(checkboxGroups).flatMap(([group, items]) => items.map((item) => [`${group}:${item}`, false]))
);

const textAreas = [
  { key: 'bodyNotes', label: 'Body notes', placeholder: 'Energy, pain, recovery, anything worth noting.' },
  { key: 'buildShipped', label: 'What did I build / test?', placeholder: 'What actually moved forward this week?' },
  { key: 'buildLearned', label: 'What did I learn?', placeholder: 'Feedback, insight, or signal.' },
  { key: 'huntProgress', label: 'Bow / hunt progress', placeholder: 'What did I do this week?' },
  { key: 'energy', label: 'What gave me energy?', placeholder: 'What felt alive, useful, or satisfying?' },
  { key: 'drain', label: 'What drained me?', placeholder: 'What made the week heavier?' },
  { key: 'nextAction', label: 'If overthinking showed up, what is the next concrete action?', placeholder: 'One next move only.' },
  { key: 'theme', label: 'Main theme of the week', placeholder: 'What kind of week was this?' },
  { key: 'win', label: 'One win', placeholder: 'Something you are actually glad you did.' },
  { key: 'improve', label: 'One thing to improve next week', placeholder: 'Keep it specific.' },
  { key: 'focusBody', label: 'Next week: body', placeholder: 'What matters most next week?' },
  { key: 'focusBuild', label: 'Next week: build', placeholder: 'One clear business/build focus.' },
  { key: 'focusBow', label: 'Next week: bow / hunt', placeholder: 'One next step.' },
];

const moodOptions = ['Rough', 'Low', 'Steady', 'Good', 'Great'];
const huntStatuses = ['Researching', 'Contacted operators', 'Comparing options', 'Ready to book', 'Booked'];

export default function WeeklyTrackerComponent() {
  const [weekOf, setWeekOf] = useState(getWeekLabel());
  const [checks, setChecks] = useState(emptyChecks);
  const [fields, setFields] = useState({
    bodyNotes: '',
    buildShipped: '',
    buildLearned: '',
    huntProgress: '',
    energy: '',
    drain: '',
    nextAction: '',
    theme: '',
    win: '',
    improve: '',
    focusBody: '',
    focusBuild: '',
    focusBow: '',
    mood: 'Steady',
    huntStatus: 'Researching',
  });

  const completion = useMemo(() => {
    const total = Object.keys(checks).length;
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
              A practical check-in for body, build, and bow / hunt. Keep it honest, not perfect.
            </p>
          </div>
          <div className="tracker-summary">
            <div className="tracker-summary-label">Completion</div>
            <div className="tracker-summary-value">{completion}%</div>
          </div>
        </div>

        <div className="tracker-top-grid">
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
              value={fields.mood}
              onChange={(e) => updateField('mood', e.target.value)}
            >
              {moodOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
          <div>
            <label className="minimal-label">Hunt status</label>
            <select
              className="minimal-input character-input"
              value={fields.huntStatus}
              onChange={(e) => updateField('huntStatus', e.target.value)}
            >
              {huntStatuses.map((option) => <option key={option}>{option}</option>)}
            </select>
          </div>
        </div>
      </section>

      {Object.entries(checkboxGroups).map(([group, items]) => (
        <section key={group} className="minimal-section panel section-card section-card-character">
          <div className="minimal-section-head">
            <div>
              <h2 className="section-title section-title-character">{group === 'body' ? 'Body' : group === 'build' ? 'Build' : group === 'bow' ? 'Bow / hunt' : 'Weekly review'}</h2>
            </div>
          </div>

          <div className="tracker-check-grid">
            {items.map((item) => {
              const key = `${group}:${item}`;
              return (
                <button
                  key={key}
                  type="button"
                  className={`tracker-check ${checks[key] ? 'tracker-check-active' : ''}`}
                  onClick={() => toggleCheck(key)}
                >
                  <span className="tracker-check-box">{checks[key] ? '✓' : ''}</span>
                  <span>{item}</span>
                </button>
              );
            })}
          </div>

          {group === 'body' && (
            <div className="tracker-notes-grid">
              <div className="tracker-mini-card">
                <div className="tracker-mini-label">Energy</div>
                <input
                  className="minimal-input character-input"
                  placeholder="__/10"
                  value={fields.energyScore || ''}
                  onChange={(e) => updateField('energyScore', e.target.value)}
                />
              </div>
              <div className="tracker-mini-card">
                <div className="tracker-mini-label">Body feels</div>
                <input
                  className="minimal-input character-input"
                  placeholder="Strong, sore, flat..."
                  value={fields.bodyFeels || ''}
                  onChange={(e) => updateField('bodyFeels', e.target.value)}
                />
              </div>
            </div>
          )}
        </section>
      ))}

      <section className="minimal-section panel section-card section-card-character">
        <div className="minimal-section-head">
          <div>
            <h2 className="section-title section-title-character">Notes</h2>
            <p className="section-subtitle section-subtitle-character">Keep the writing short and useful.</p>
          </div>
        </div>

        <div className="tracker-text-grid">
          {textAreas.map((field) => (
            <div key={field.key}>
              <label className="minimal-label" htmlFor={field.key}>{field.label}</label>
              <textarea
                id={field.key}
                className="minimal-textarea character-input tracker-textarea"
                placeholder={field.placeholder}
                value={fields[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
