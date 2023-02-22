import PropTypes from 'prop-types';

const ActivityGroup = ({activity, handleOnChange}) => {

  return (
    <span>
      <input className="form-check-input h-4 w-4 border border-gray-300 rounded-sm bg-white checked:bg-sky-700 
          checked:border-blue-600 focus:outline-none transition duration-200 mt-1 align-top bg-no-repeat 
          bg-center bg-contain float-left mr-2 cursor-pointer" 
          type="checkbox" 
          id={activity.id} 
          value={activity.id} 
          onChange={() => handleOnChange(!activity.checked, activity.id)} 
          checked={activity.checked}
        />
        <label className="form-check-label inline-block text-gray-800" htmlFor={activity.id}>{activity.label}</label>
    </span>
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
