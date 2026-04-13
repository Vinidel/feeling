import React, { useMemo } from 'react'
import moment from 'moment'
import { Chart } from 'react-charts'

const clampMood = (value) => {
  if (!Number.isFinite(value)) {
    return null
  }
  return Math.min(4, Math.max(0, value))
}

const parseEntryDate = (raw) => {
  const parsed = raw instanceof Date ? raw : new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
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
        scale: (value) => moment(value).format('MMM D'),
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
          scale: (value) => value.toFixed(0),
          tooltip: (value) => value.toFixed(0),
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
