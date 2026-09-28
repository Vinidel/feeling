# Future features (deferred from the UI redesign)

The Bloom Calm redesign intentionally shipped as a restyle only. The design
prototypes also showed the features below. Each one can be computed in the
browser from data the app already stores, so none of them needs an API or
database change. Each can be picked up on its own branch.

## Data available today

| Source | Shape used by these features |
| --- | --- |
| `GET /api/feelings` | Array of the user's entries: `status` (string `"0"`–`"4"`, Rough → Great), `createdAt` (ISO timestamp), `comment`, and `activities` (`{ bow, run, lift, swim, cycle }` booleans). It returns the full history with no date filter, and `WithFetch` polls it every 15 seconds. |
| `GET /api/weekly-tracker?weekOf=YYYY-MM-DD` | One week's record (or `null`): `mood` (`rough`/`low`/`steady`/`good`/`great`), `checks` (six booleans), and `notes` (`win`, `challenge`, `nextWeek`). |

`client/src/components/FeelingChartComponent.js` already has the helpers these
features need (`normalizeEntries`, `aggregateLatestPerDay`, `filterEntriesSince`,
`averageMood`, `dayKey`). Moving them into a shared module such as
`client/src/feelingStats.js`, with unit tests, is a good first step before
building any of the features below.

## 1. Check-in streak

**What:** A small card or badge showing "N-day streak": the number of
consecutive days, up to today, that have at least one check-in.

**Derived from:** `createdAt` in `/api/feelings`.

**Implementation notes:**
- Bucket entries by local calendar day (use `dayKey`, not UTC dates, so late-evening entries count for the right day).
- Walk backwards from today. Decide whether a streak survives when today has no entry yet; allowing it to start from yesterday avoids a streak dropping to 0 every morning.
- Optionally show the longest streak in the last 30 or 90 days as well.
- Suggested placement: the History and trends card header, or next to "Trend snapshot".

## 2. Mood calendar

**What:** A Monday-aligned grid of the last 5 weeks (or a full month). Each day is
coloured by that day's mood, empty days show as an outline, and today is highlighted.

**Derived from:** `status` + `createdAt` in `/api/feelings`.

**Implementation notes:**
- Use `aggregateLatestPerDay` so days with several entries show the latest one, matching the chart.
- Pad the start of the grid so the first column is Monday. The current week can be a partial row.
- Use the existing mood CSS variables (`--st-rough` … `--st-great`) and add a legend.
- Tapping a day could open or scroll to that day's history entry. That is extra scope and should be decided separately.
- If history becomes very large, consider a date-range query parameter on the API later. It isn't needed now.

## 3. Activity breakdown

**What:** A small bar chart with one bar per activity (Bow, Run, Lift, Swim, Cycle),
showing how many days each was logged in the last 30 days.

**Derived from:** `activities` + `createdAt` in `/api/feelings`.

**Implementation notes:**
- Filter to the window with `filterEntriesSince`, then count `true` values per key.
- Reuse the existing `.st-bar-*` styles from the Trend snapshot.
- A later extension could show average mood on days with and without each activity (for example, "Run days average Good"). Label it as a correlation, not a cause.

## 4. Week-over-week comparison

**What:** An explicit comparison card, for example "Average mood 2.9 this week, up
0.4 from last week · 7 vs 5 check-ins".

**Derived from:** `status` + `createdAt` in `/api/feelings`.

**Implementation notes:**
- The chart summary already computes a coarse label ("Up from last week" / "Down from last week" / "Steady vs last week") in `formatTrend`. This feature exposes the underlying numbers: both averages, the delta, and check-in counts.
- Decide whether "week" means the last 7 rolling days (what the chart uses today) or the calendar week starting Monday (what the weekly tracker uses). Pick one and label it clearly.
- Comparing weekly-tracker completion across weeks would need a second `GET /api/weekly-tracker` call for the previous `weekOf` (or a new list endpoint). Keep that out of the first version.

## 5. Emoji weekly-mood picker

**What:** Replace the "Week overall felt" `<select>` on the Weekly tracker with the
same tappable mood blobs used by the daily check-in.

**Derived from:** The existing `mood` field. The picker's keys (`rough`, `low`,
`steady`, `good`, `great`) already match `moodOptions` in
`WeeklyTrackerComponent.js` and `key` in `moodMeta.js`, so the saved payload is unchanged.

**Implementation notes:**
- Extract the blob picker from `FeelingComponent.js` into a reusable `MoodPicker` component. Keep `aria-pressed` and an accessible label on each button, or use a `radiogroup`.
- `client/src/weeklyJourney.test.js` currently finds the control with `container.querySelector('select')` and changes its value, so this test must be updated to click the blob button instead. The payload assertions (`mood: 'great'`) stay the same.
- Keep a visible text label for the selected mood ("Felt good") for clarity and screen readers.
