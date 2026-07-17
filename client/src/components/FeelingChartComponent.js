import React, { useMemo } from 'react'
import moment from 'moment'
import { curveStepAfter } from 'd3-shape'
import { Chart } from 'react-charts'

const MOOD_META = [
  { value: 0, emoji: '😔', label: 'Rough' },
  { value: 1, emoji: '🙁', label: 'Low' },
  { value: 2, emoji: '😐', label: 'Steady' },
  { value: 3, emoji: '🙂', label: 'Good' },
  { value: 4, emoji: '😀', label: 'Great' },
]

const CHART_WINDOW_DAYS = 30
const SUMMARY_WINDOW_DAYS = 7

const clampMood = (value) => {
  if (!Number.isFinite(value)) {
    return null
  }
  return Math.min(4, Math.max(0, value))
}

const getMoodMeta = (value) => {
  const status = clampMood(value)
  if (status === null) {
    return MOOD_META[2]
  }
  return MOOD_META[status]
}

const parseEntryDate = (raw) => {
  if (!raw) {
    return null
  }
  const parsed = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  if (parsed.getUTCFullYear() < 1970) {
    return null
  }

  return parsed
}

const startOfDay = (date) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

const endOfDay = (date) => {
  const next = new Date(date)
  next.setHours(23, 59, 59, 999)
  return next
}

const dayKey = (date) => moment(date).format('YYYY-MM-DD')

const normalizeEntries = (feelingHistory) => {
  const rows = Array.isArray(feelingHistory) ? feelingHistory : []
  const entries = []

  for (const entry of rows) {
    const date = parseEntryDate(entry.createdAt)
    if (!date) {
      continue
    }
    const status = clampMood(Number.parseInt(entry.status, 10))
    if (status === null) {
      continue
    }
    entries.push({ date, status })
  }

  entries.sort((a, b) => a.date - b.date)
  return entries
}

const aggregateLatestPerDay = (entries) => {
  const byDay = new Map()

  for (const entry of entries) {
    byDay.set(dayKey(entry.date), entry)
  }

  return Array.from(byDay.values()).sort((a, b) => a.date - b.date)
}

const filterEntriesSince = (entries, daysAgo) => {
  const cutoff = startOfDay(new Date())
  cutoff.setDate(cutoff.getDate() - daysAgo)
  return entries.filter((entry) => entry.date >= cutoff)
}

const averageMood = (entries) => {
  if (!entries.length) {
    return null
  }
  const total = entries.reduce((sum, entry) => sum + entry.status, 0)
  return total / entries.length
}

const dominantMood = (entries) => {
  if (!entries.length) {
    return null
  }

  const counts = entries.reduce((accumulator, entry) => {
    const label = getMoodMeta(entry.status).label
    return {
      ...accumulator,
      [label]: (accumulator[label] || 0) + 1,
    }
  }, {})

  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
}

const formatTrend = (recentEntries, priorEntries) => {
  if (!recentEntries.length) {
    return 'No check-ins this week'
  }

  if (!priorEntries.length) {
    return `${recentEntries.length} check-in${recentEntries.length === 1 ? '' : 's'} this week`
  }

  const recentAverage = averageMood(recentEntries)
  const priorAverage = averageMood(priorEntries)
  const delta = recentAverage - priorAverage

  if (delta >= 0.5) {
    return 'Up from last week'
  }
  if (delta <= -0.5) {
    return 'Down from last week'
  }
  return 'Steady vs last week'
}

const formatAxisMood = (value) => {
  if (value == null) {
    return ''
  }
  const status = clampMood(Number(value))
  if (status === null) {
    return ''
  }
  const mood = getMoodMeta(status)
  return `${mood.emoji} ${mood.label}`
}

export default function FeelingChartComponent({ feelingHistory }) {
  const chartData = useMemo(() => {
    const entries = normalizeEntries(feelingHistory)
    const recentEntries = filterEntriesSince(entries, CHART_WINDOW_DAYS)
    const chartEntries = aggregateLatestPerDay(recentEntries)

    const today = endOfDay(new Date())
    const windowStart = startOfDay(new Date())
    windowStart.setDate(windowStart.getDate() - CHART_WINDOW_DAYS)

    const lastWeekStart = startOfDay(new Date())
    lastWeekStart.setDate(lastWeekStart.getDate() - SUMMARY_WINDOW_DAYS)

    const priorWeekStart = startOfDay(new Date())
    priorWeekStart.setDate(priorWeekStart.getDate() - (SUMMARY_WINDOW_DAYS * 2))

    const lastWeekEntries = entries.filter((entry) => entry.date >= lastWeekStart)
    const priorWeekEntries = entries.filter(
      (entry) => entry.date >= priorWeekStart && entry.date < lastWeekStart
    )

    const summary = {
      dominantLabel: dominantMood(lastWeekEntries),
      checkInCount: lastWeekEntries.length,
      trendLabel: formatTrend(lastWeekEntries, priorWeekEntries),
    }

    return {
      chartEntries,
      windowStart,
      windowEnd: today,
      summary,
    }
  }, [feelingHistory])

  const chartSeries = useMemo(
    () => [
      {
        label: 'Mood',
        data: chartData.chartEntries,
      },
    ],
    [chartData.chartEntries]
  )

  const primaryAxis = useMemo(
    () => ({
      scaleType: 'localTime',
      getValue: (datum) => datum.date,
      min: chartData.windowStart,
      max: chartData.windowEnd,
      formatters: {
        scale: (value) => moment(value).format('MMM D'),
        tooltip: (value) => moment(value).format('ddd, MMM D'),
      },
    }),
    [chartData.windowEnd, chartData.windowStart]
  )

  const secondaryAxes = useMemo(
    () => [
      {
        scaleType: 'linear',
        getValue: (datum) => datum.status,
        elementType: 'line',
        curve: curveStepAfter,
        showDatumElements: true,
        min: 0,
        max: 4,
        tickCount: 5,
        formatters: {
          scale: formatAxisMood,
          tooltip: (value) => {
            const mood = getMoodMeta(value)
            return `${mood.emoji} ${mood.label}`
          },
        },
      },
    ],
    []
  )

  const { summary } = chartData
  const hasRecentChartData = chartData.chartEntries.length > 0

  return (
    <div className="mood-chart-panel">
      <div className="mood-chart-summary">
        <div className="mood-chart-summary-main">
          <span className="mood-chart-summary-label">Last 7 days</span>
          <span className="mood-chart-summary-value">
            {summary.dominantLabel ? `Mostly ${summary.dominantLabel}` : 'No check-ins yet'}
          </span>
        </div>
        <div className="mood-chart-summary-meta">
          <span>{summary.checkInCount} check-in{summary.checkInCount === 1 ? '' : 's'}</span>
          <span className="mood-chart-summary-divider">·</span>
          <span>{summary.trendLabel}</span>
        </div>
      </div>

      {hasRecentChartData ? (
        <div className="mood-chart-canvas">
          <Chart
            options={{
              data: chartSeries,
              primaryAxis,
              secondaryAxes,
              dark: true,
              getDatumStyle: () => ({
                circle: {
                  r: 4,
                  strokeWidth: 2,
                },
              }),
            }}
          />
        </div>
      ) : (
        <div className="mood-chart-empty">
          No check-ins in the last {CHART_WINDOW_DAYS} days. Your next save will show up here.
        </div>
      )}
    </div>
  )
}
