import React from 'react'
import { Chart } from 'react-charts'

export default function MyChart({feelingHistory}) {
  const preparedData = () => {
    return feelingHistory.map((e) => ([Number.parseInt(e.status), e.createdAt]))
    // return [[0, "10/10/2020"], [1, "11/10/2020"]]
  }

  const data = React.useMemo(
    () => [
      {
        data: preparedData()
      }
    ],
    []
  )

  const axes = React.useMemo(
    () => [
      { primary: true, type: 'utc', position: 'bottom' },
      { type: 'linear', position: 'left' }
    ],
    []
  )

 return (
    // A react-chart hyper-responsively and continuously fills the available
    // space of its parent element automatically
    <div
      style={{
        width: '400px',
        height: '300px'
      }}
    >
      <Chart data={data} axes={axes} />
    </div>
  )
}
