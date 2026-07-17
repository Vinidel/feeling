export const MOOD_OPTIONS = [
  {
    value: 0,
    emoji: '😔',
    label: 'Rough',
    moodTone: 'mood-tone-rough',
    historyTone: 'history-tone-rough',
    trendTone: 'history-trend-tone-rough',
  },
  {
    value: 1,
    emoji: '🙁',
    label: 'Low',
    moodTone: 'mood-tone-low',
    historyTone: 'history-tone-low',
    trendTone: 'history-trend-tone-low',
  },
  {
    value: 2,
    emoji: '😐',
    label: 'Steady',
    moodTone: 'mood-tone-steady',
    historyTone: 'history-tone-steady',
    trendTone: 'history-trend-tone-steady',
  },
  {
    value: 3,
    emoji: '🙂',
    label: 'Good',
    moodTone: 'mood-tone-good',
    historyTone: 'history-tone-good',
    trendTone: 'history-trend-tone-good',
  },
  {
    value: 4,
    emoji: '😀',
    label: 'Great',
    moodTone: 'mood-tone-great',
    historyTone: 'history-tone-great',
    trendTone: 'history-trend-tone-great',
  },
]

export const DEFAULT_MOOD_VALUE = 2

export const clampMood = (value) => {
  if (!Number.isFinite(value)) {
    return null
  }
  return Math.min(4, Math.max(0, value))
}

export const getMoodByValue = (value) => {
  const status = clampMood(Number.parseInt(value, 10))
  if (status === null) {
    return MOOD_OPTIONS[DEFAULT_MOOD_VALUE]
  }
  return MOOD_OPTIONS[status]
}
