import React from 'react'

const SpinnerComponent = () => {
  return (
    <div className="st-spinner">
      <div className="st-spinner-pill">
        <span className="st-spinner-ring" />
        Loading entries...
      </div>
    </div>
  )
}

export default SpinnerComponent;
