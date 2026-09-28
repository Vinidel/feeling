export const MOOD_OPTIONS = [
  {
    value: 0,
    key: 'rough',
    emoji: '😔',
    label: 'Rough',
  },
  {
    value: 1,
    key: 'low',
    emoji: '🙁',
    label: 'Low',
  },
  {
    value: 2,
    key: 'steady',
    emoji: '😐',
    label: 'Steady',
  },
  {
    value: 3,
    key: 'good',
    emoji: '🙂',
    label: 'Good',
  },
  {
    value: 4,
    key: 'great',
    emoji: '😀',
    label: 'Great',
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
