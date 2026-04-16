import React, { useMemo } from 'react'
import moment from 'moment'
import { Chart } from 'react-charts'

const clampMood = (value) => {
  if (!Number.isFinite(value)) {
    return null
  }
  return Math.min(4, Math.max(0, value))
}

/** react-charts may pass null into formatters during tooltip/hover updates */
const formatAxisNumber = (value) => {
  if (value == null) {
    return ''
  }
  const n = Number(value)
  return Number.isFinite(n) ? n.toFixed(0) : ''
}

const parseEntryDate = (raw) => {
  if (!raw) {
    return null
  }
  const parsed = raw instanceof Date ? raw : new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  // Some persisted records use year 0001 as an "empty" value and should not be charted.
  if (parsed.getUTCFullYear() < 1970) {
    return null
  }

  return parsed
}

export default function FeelingChartComponent({ feelingHistory }) {
  const chartSeries = useMemo(() => {
    const rows = Array.isArray(feelingHistory) ? feelingHistory : []
    const points = []

    for (const entry of rows) {
      const date = parseEntryDate(entry.createdAt)
      if (!date) {
        continue
      }
      const status = clampMood(Number.parseInt(entry.status, 10))
      if (status === null) {
        continue
      }
      points.push({ date, status })
    }

    points.sort((a, b) => a.date - b.date)

    return [
      {
        label: 'Mood',
        data: points,
      },
    ]
  }, [feelingHistory])

  const primaryAxis = useMemo(
    () => ({
      scaleType: 'localTime',
      getValue: (datum) => datum.date,
      formatters: {
        scale: (value) => moment(value).format('MMM D, YYYY'),
        tooltip: (value) => moment(value).format('lll'),
      },
    }),
    []
  )

  const secondaryAxes = useMemo(
    () => [
      {
        scaleType: 'linear',
        getValue: (datum) => datum.status,
        elementType: 'line',
        min: 0,
        max: 4,
        tickCount: 5,
        formatters: {
          scale: formatAxisNumber,
          tooltip: formatAxisNumber,
        },
      },
    ],
    []
  )

  if (!chartSeries[0].data.length) {
    return null
  }

  return (
    <div
      style={{
        height: '300px',
      }}
    >
      <Chart
        options={{
          data: chartSeries,
          primaryAxis,
          secondaryAxes,
        }}
      />
    </div>
  )
}
