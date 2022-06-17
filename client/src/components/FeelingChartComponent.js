import React from 'react'
import { AxisOptions, Chart } from "react-charts";

export default function MyChart({feelingHistory}) {
  const preparedData = () => {
    return feelingHistory.map((e) => (
      {
        status: Number.parseInt(e.status),
        date: new Date(e.createdAt),
      }
    ))
  }

  const data = [
      {
        label: 'Report',
        data: preparedData()
      }
    ]

  const primaryAxis = React.useMemo(
    () => ({
    getValue: datum => datum.date,
  }),
    []
)

  const secondaryAxes = React.useMemo(
    () => [
    {
      getValue: datum => datum.status,
      elementType: 'line',
    },
  ],
    []
)

 return (
    <div
      style={{
        height: '300px'
      }}
    >
      <Chart
        options={{
          data,
          primaryAxis,
          secondaryAxes,
        }}
      />
    </div>
  )
}
