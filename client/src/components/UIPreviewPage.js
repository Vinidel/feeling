import React from 'react';

const moodOptions = [
  { value: 0, label: 'Rough', emoji: '😔' },
  { value: 1, label: 'Low', emoji: '🙁' },
  { value: 2, label: 'Steady', emoji: '😐' },
  { value: 3, label: 'Good', emoji: '🙂' },
  { value: 4, label: 'Great', emoji: '😀' },
];

const mockEntries = [
  { date: '12 Apr 2026', mood: 'Good', note: 'Focused blocks and a short walk after lunch.', activities: ['Run'] },
  { date: '11 Apr 2026', mood: 'Steady', note: 'Normal day. Good energy in the afternoon.', activities: ['Lift'] },
  { date: '10 Apr 2026', mood: 'Low', note: 'Busy morning and skipped a break.', activities: ['Cycle'] },
  { date: '09 Apr 2026', mood: 'Great', note: 'Solid progress and enough sleep.', activities: ['Swim', 'Run'] },
  { date: '08 Apr 2026', mood: 'Steady', note: 'No major highs or lows.', activities: [] },
];

const paletteMap = {
  Rough: { className: 'preview-tone-rough', score: 1 },
  Low: { className: 'preview-tone-low', score: 2 },
  Steady: { className: 'preview-tone-steady', score: 3 },
  Good: { className: 'preview-tone-good', score: 4 },
  Great: { className: 'preview-tone-great', score: 5 },
};

const trendRows = moodOptions.map((option) => {
  const total = mockEntries.filter((entry) => entry.mood === option.label).length;
  const percentage = Math.round((total / mockEntries.length) * 100);
  return {
    label: option.label,
    percentage,
    total,
    className: paletteMap[option.label].className,
  };
});

const averageScore = (
  mockEntries.reduce((sum, entry) => sum + paletteMap[entry.mood].score, 0) / mockEntries.length
).toFixed(1);

const UIPreviewPage = () => {
  return (
    <div className="preview-layout">
      <section className="panel section-card section-card-character preview-hero">
        <div className="preview-kicker">UI concept preview</div>
        <h1 className="preview-title">A cleaner check-in flow with clearer trend insight</h1>
        <p className="preview-subtitle">
          This mock page shows how your app can look with improved hierarchy, stronger empty/loading states,
          and a more useful history plus trend area.
        </p>
        <div className="preview-chip-row">
          <span className="preview-chip">Improved readability</span>
          <span className="preview-chip">Better mobile structure</span>
          <span className="preview-chip">Insight-first history</span>
        </div>
      </section>

      <section className="preview-grid">
        <article className="panel section-card section-card-character">
          <div className="minimal-section-head">
            <div>
              <h2 className="section-title section-title-character">Check-in (proposed)</h2>
              <p className="section-subtitle section-subtitle-character">
                Keeps your current flow, but improves spacing and action clarity.
              </p>
            </div>
          </div>

          <div className="preview-checkin-block">
            <div className="minimal-mood-grid">
              {moodOptions.map((option) => (
                <div
                  key={option.value}
                  className={`minimal-mood-card character-mood-card ${
                    option.label === 'Good' ? 'minimal-mood-card-selected character-mood-card-selected' : ''
                  }`}
                >
                  <span className="minimal-mood-emoji character-mood-emoji">{option.emoji}</span>
                  <span className="minimal-mood-text character-mood-text">{option.label}</span>
                </div>
              ))}
            </div>

            <div className="preview-form-row">
              <div>
                <label className="minimal-label">Date</label>
                <div className="minimal-input character-input">2026-04-12</div>
              </div>
              <div>
                <label className="minimal-label">Note</label>
                <div className="minimal-textarea character-input">
                  "Felt better after going for a run and taking a short screen break."
                </div>
              </div>
            </div>

            <div className="preview-actions">
              <button type="button" className="minimal-primary-button character-primary-button">
                Save check-in
              </button>
            </div>
          </div>
        </article>

        <article className="panel section-card section-card-character">
          <div className="minimal-section-head">
            <div>
              <h2 className="section-title section-title-character">History and trend (proposed)</h2>
              <p className="section-subtitle section-subtitle-character">
                Scan recent entries quickly, with at-a-glance distribution.
              </p>
            </div>
          </div>

          <div className="preview-metrics">
            <div className="preview-metric">
              <div className="preview-metric-label">Entries</div>
              <div className="preview-metric-value">{mockEntries.length}</div>
            </div>
            <div className="preview-metric">
              <div className="preview-metric-label">Average mood</div>
              <div className="preview-metric-value">{averageScore} / 5</div>
            </div>
            <div className="preview-metric">
              <div className="preview-metric-label">Last check-in</div>
              <div className="preview-metric-value">{mockEntries[0].date}</div>
            </div>
          </div>

          <div className="preview-history-grid">
            <div className="minimal-history-list">
              {mockEntries.map((entry) => (
                <div
                  key={`${entry.date}-${entry.mood}`}
                  className={`minimal-history-item character-history-item ${paletteMap[entry.mood].className}`}
                >
                  <div className="minimal-history-button">
                    <div className="minimal-history-main">
                      <div>
                        <div className="minimal-history-title">{entry.mood}</div>
                        <div className="minimal-history-date">{entry.date}</div>
                      </div>
                    </div>
                    <div className="minimal-history-side">
                      <div className="minimal-history-tags">
                        {entry.activities.length ? (
                          entry.activities.map((activity) => (
                            <span key={`${entry.date}-${activity}`} className="minimal-tag character-tag">
                              {activity}
                            </span>
                          ))
                        ) : (
                          <span className="minimal-tag character-tag">No activity</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="minimal-history-note character-history-note">{entry.note}</div>
                </div>
              ))}
            </div>

            <div className="preview-trend-card">
              <h3 className="preview-trend-title">Mood distribution</h3>
              <div className="preview-trend-list">
                {trendRows.map((row) => (
                  <div className="preview-trend-row" key={row.label}>
                    <div className="preview-trend-head">
                      <span>{row.label}</span>
                      <span>{row.total} entries</span>
                    </div>
                    <div className="preview-trend-track">
                      <div className={`preview-trend-fill ${row.className}`} style={{ width: `${row.percentage}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
};

export default UIPreviewPage;
