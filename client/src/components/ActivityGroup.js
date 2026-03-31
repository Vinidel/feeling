import PropTypes from 'prop-types';

const activityMeta = {
  bow: { label: 'Bow', icon: '🏹' },
  run: { label: 'Run', icon: '🏃' },
  lift: { label: 'Lift', icon: '🏋️' },
  swim: { label: 'Swim', icon: '🏊' },
  cycle: { label: 'Cycle', icon: '🚴' },
};

const ActivityGroup = ({activity, handleOnChange}) => {
  const meta = activityMeta[activity.id] || { label: activity.label, icon: '✨' };

  return (
    <label
      htmlFor={activity.id}
      className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition ${
        activity.checked
          ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-sm'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <input
        className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
        type="checkbox"
        id={activity.id}
        value={activity.id}
        onChange={() => handleOnChange(!activity.checked, activity.id)}
        checked={activity.checked}
      />
      <span className="text-lg" aria-hidden="true">{meta.icon}</span>
      <span className="text-sm font-medium">{meta.label}</span>
    </label>
  )
}

ActivityGroup.propTypes = {
  activity: PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string,
    checked: PropTypes.bool,
  }),
  handleOnChange: PropTypes.func,
}

export default ActivityGroup;
