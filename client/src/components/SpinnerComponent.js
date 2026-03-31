import React from 'react'

const SpinnerComponent = () => {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white/80 px-4 py-3 text-sm font-medium text-slate-600 shadow-sm">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
        Loading entries...
      </div>
    </div>
  )
}

export default SpinnerComponent;
