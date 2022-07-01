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
        <form className="form-group row">
          <div className="row col-sm-12 row-container mb-4">
            <label className="col-sm-6 col-form-label">
              How are you feeling today:
            </label>
            <div className="col-sm-6">
              <div className="btn-group">
                <button type="button" className={`btn btn-primary-outline btn-emoji bg-sky-800 hover:bg-sky-700 active:bg-blue-800 focus:bg-blue-800 rounded mr-2 ${isSelected(0)}`} onClick={() => setStatus(0)}>😔</button>
                <button type="button" className={`btn btn-primary-outline btn-emoji bg-sky-800 hover:bg-sky-700 active:bg-blue-800 focus:bg-blue-800 rounded mr-2 ${isSelected(1)}`} onClick={() => setStatus(1)}>🙁</button>
                <button type="button" className={`btn btn-primary-outline btn-emoji bg-sky-800 hover:bg-sky-700 active:bg-blue-800 focus:bg-blue-800 rounded mr-2 ${isSelected(2)}`} onClick={() => setStatus(2)}>😐</button>
                <button type="button" className={`btn btn-primary-outline btn-emoji bg-sky-800 hover:bg-sky-700 active:bg-blue-800 focus:bg-blue-800 rounded mr-2 ${isSelected(3)}`} onClick={() => setStatus(3)}>🙂</button>
                <button type="button" className={`btn btn-primary-outline btn-emoji bg-sky-800 hover:bg-sky-700 active:bg-blue-800 focus:bg-blue-800 rounded mr-2 ${isSelected(4)}`} onClick={() => setStatus(4)}>😀</button>
              </div>
            </div>
          </div>
          <div className="row row-container col-sm-12 mb-4">
            <label className="col-sm-6 col-form-label">
              Comment why you are feeling like this:
            </label>
            <div className="col-sm-6">
              <textarea name="comment" id="comment" className="form-control" value={state.comment} onChange={handleCommentChange} />
            </div>
          </div>
          
          <div className="row row-container col-sm-12 mb-4">
            <label className="col-sm-6 col-form-label">
              Today's activity:
            </label>
            <div className="col-sm-6">
              <div class="form-check form-check-inline">
                <input class="form-check-input h-4 w-4 border border-gray-300 rounded-sm bg-white checked:bg-sky-700 
                  checked:border-blue-600 focus:outline-none transition duration-200 mt-1 align-top bg-no-repeat 
                  bg-center bg-contain float-left mr-2 cursor-pointer" 
                  type="checkbox" 
                  id="run" 
                  value="run" 
                  onClick={() => setActivity(!state.activities.run, "run")} 
                  checked={state.activities.run}
                />
                <label class="form-check-label inline-block text-gray-800" for="run">Run</label>
              </div>  
              <div class="form-check form-check-inline">
                <input class="form-check-input h-4 w-4 border border-gray-300 rounded-sm bg-white checked:bg-sky-700 
                  checked:border-blue-600 focus:outline-none transition duration-200 mt-1 align-top bg-no-repeat 
                  bg-center bg-contain float-left mr-2 cursor-pointer" 
                  type="checkbox" 
                  id="bow" 
                  value="bow" 
                  onClick={() => setActivity(!state.activities.bow, "bow")} 
                  checked={state.activities.bow}
                />
                <label class="form-check-label inline-block text-gray-800" for="bow">Bow</label>
              </div>  
              <div class="form-check form-check-inline">
                <input class="form-check-input h-4 w-4 border border-gray-300 rounded-sm bg-white checked:bg-sky-700 
                checked:border-blue-600 focus:outline-none transition duration-200 mt-1 align-top bg-no-repeat 
                bg-center bg-contain float-left mr-2 cursor-pointer" 
                type="checkbox" 
                id="gym" 
                value="gym" 
                onClick={() => setActivity(!state.activities.lift, "lift")} 
                checked={state.activities.lift}
              />
                <label class="form-check-label inline-block text-gray-800" for="gym">Gym</label>
              </div>  
            </div>
          </div>
        </form>
        <div className="btn-container text-right">
          <button
            className="group relative justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
