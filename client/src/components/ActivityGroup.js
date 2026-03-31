import PropTypes from 'prop-types';

const activityMeta = {
  bow: { label: 'Bow', icon: '🏹' },
  run: { label: 'Run', icon: '🏃' },
  lift: { label: 'Lift', icon: '🏋️' },
  swim: { label: 'Swim', icon: '🏊' },
  cycle: { label: 'Cycle', icon: '🚴' },
};

const ActivityGroup = ({activity, handleOnChange}) => {
  const meta = activityMeta[activity.id] || { label: activity.label, icon: '•' };

  return (
    <label
      htmlFor={activity.id}
      className={`minimal-activity-chip ${activity.checked ? 'minimal-activity-chip-selected' : ''}`}
    >
      <input
        className="minimal-checkbox"
        type="checkbox"
        id={activity.id}
        value={activity.id}
        onChange={() => handleOnChange(!activity.checked, activity.id)}
        checked={activity.checked}
      />
      <span aria-hidden="true">{meta.icon}</span>
      <span>{meta.label}</span>
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
