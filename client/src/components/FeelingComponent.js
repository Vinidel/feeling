import React, { useState, useEffect } from 'react'
import axios from 'axios';
import FeelingtHistoryComponent from './FeelingtHistoryComponent';
import {BASE_API_URL} from '../config';
import {useAuth0} from "@auth0/auth0-react";
import Profile from "./UserDetailsComponent";
import NavBar from "./NavBar";
import WithFetch from "./WithFetch";

const FeelingComponent  = ()  =>{
  const auth = useAuth0();
  const [update, forceUpdate] = useState(0)
  const [state, setState] = useState({
    status: null,
    createdAt: '',
    comment: '',
    activities: {
      bow: false,
      run: false,
      lift: false,
    },
  });

  const isSelected = (status) => {
    return state.status === status ? "bg-blue-800" : "";
  }

  const setStatus = (status) => {
    setState((prevState) => {
      return {
        ...prevState,
        status,
        createdAt: new Date().toISOString(),
      }
    })
  }

  const setActivity = (value, activityName) => {
    setState((prevState) => {
      return {
        ...prevState,
        activities: {
          ...prevState.activities,
          [activityName]: value,
        }
      }
    })
  }

  const handleCommentChange = (event) => {
    event.persist();
    setState((prevState) => {
      return {
        ...prevState,
        comment: event.target.value,
      }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = await auth.getAccessTokenSilently({
      audience: "https://stormy-cliffs-52671.herokuapp.com/api",
    });
    console.log('Calling post with', state)
    return axios.post(`${BASE_API_URL}/api/feelings`,
      {
        status: state.status.toString(),
        createdAt: state.createdAt,
        comment: state.comment,
        activities: state.activities,
      }, {
        headers: {
          "x-user-id": auth.user.sub,
          Authorization: `Bearer ${token}`,
        }
      })
      .then((res) => {
        console.log('Calling set state')
        setState({
          status: null,
          createdAt: '',
          comment: '',
          activities: {
            bow: false,
            run: false,
            lift: false,
          },
        });
        return forceUpdate(n => n+1);
      })
      .catch(e => console.log('Error', e))
  }

  return (
    <div>
      <div className="App-tile">
        <form className="form-group">
          <div className="flex flex-col sm:flex-row sm:justify-between mb-4">
            <label className="self-center sm:self-start col-form-label">
              How are you feeling today:
            </label>
            <div className="self-center">
              <div className="btn-group">
                <button type="button" className={`btn btn-primary-outline btn-emoji bg-sky-800 hover:bg-sky-700 active:bg-blue-800 focus:bg-blue-800 rounded mr-2 ${isSelected(0)}`} onClick={() => setStatus(0)}>😔</button>
                <button type="button" className={`btn btn-primary-outline btn-emoji bg-sky-800 hover:bg-sky-700 active:bg-blue-800 focus:bg-blue-800 rounded mr-2 ${isSelected(1)}`} onClick={() => setStatus(1)}>🙁</button>
                <button type="button" className={`btn btn-primary-outline btn-emoji bg-sky-800 hover:bg-sky-700 active:bg-blue-800 focus:bg-blue-800 rounded mr-2 ${isSelected(2)}`} onClick={() => setStatus(2)}>😐</button>
                <button type="button" className={`btn btn-primary-outline btn-emoji bg-sky-800 hover:bg-sky-700 active:bg-blue-800 focus:bg-blue-800 rounded mr-2 ${isSelected(3)}`} onClick={() => setStatus(3)}>🙂</button>
                <button type="button" className={`btn btn-primary-outline btn-emoji bg-sky-800 hover:bg-sky-700 active:bg-blue-800 focus:bg-blue-800 rounded mr-2 ${isSelected(4)}`} onClick={() => setStatus(4)}>😀</button>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:justify-between mb-4">
            <label className="self-center col-form-label">
              Today's activity:
            </label>
            <div className="self-center ">
              <div className="form-check form-check-inline">
                <input className="form-check-input h-4 w-4 border border-gray-300 rounded-sm bg-white checked:bg-sky-700 
                  checked:border-blue-600 focus:outline-none transition duration-200 mt-1 align-top bg-no-repeat 
                  bg-center bg-contain float-left mr-2 cursor-pointer" 
                  type="checkbox" 
                  id="run" 
                  value="run" 
                  onClick={() => setActivity(!state.activities.run, "run")} 
                  checked={state.activities.run}
                />
                <label className="form-check-label inline-block text-gray-800" htmlFor="run">Run</label>
              </div>  
              <div className="form-check form-check-inline">
                <input className="form-check-input h-4 w-4 border border-gray-300 rounded-sm bg-white checked:bg-sky-700 
                  checked:border-blue-600 focus:outline-none transition duration-200 mt-1 align-top bg-no-repeat 
                  bg-center bg-contain float-left mr-2 cursor-pointer" 
                  type="checkbox" 
                  id="bow" 
                  value="bow" 
                  onClick={() => setActivity(!state.activities.bow, "bow")} 
                  checked={state.activities.bow}
                />
                <label className="form-check-label inline-block text-gray-800" htmlFor="bow">Bow</label>
              </div>  
              <div className="form-check form-check-inline">
                <input className="form-check-input h-4 w-4 border border-gray-300 rounded-sm bg-white checked:bg-sky-700 
                checked:border-blue-600 focus:outline-none transition duration-200 mt-1 align-top bg-no-repeat 
                bg-center bg-contain float-left mr-2 cursor-pointer" 
                type="checkbox" 
                id="gym" 
                value="gym" 
                onClick={() => setActivity(!state.activities.lift, "lift")} 
                checked={state.activities.lift}
              />
                <label className="form-check-label inline-block text-gray-800" htmlFor="gym">Gym</label>
              </div>  
            </div>
          </div>
          <div className="flex mb-4">
            <div className="flex-auto">
              <textarea name="comment" 
              placeholder="Describe the reason why you are feeling this way"
              id="comment" 
              className="form-control" 
              value={state.comment} 
              onChange={handleCommentChange} />
            </div>
          </div>
        </form>
        <div className="btn-container md:text-right">
          <button
            className="group relative justify-center
            w-full md:w-32
            py-2 px-4 border border-transparent text-sm
            font-medium rounded-md text-white bg-sky-800 
            hover:bg-sky-700 focus:outline-none focus:ring-2 
            focus:ring-offset-2 focus:ring-indigo-500"
            type="button"
            onClick={handleSubmit}>Save</button>
        </div>
        <br />
        <WithFetch
          update={update}
          url={`${BASE_API_URL}/api/feelings`}
          render={({data, isFetching}) => (<FeelingtHistoryComponent data={data} isFetching={isFetching}/>)}
        />
      </div>
    </div>

  );
}

export default FeelingComponent;
