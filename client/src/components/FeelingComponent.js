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
    return state.status === status ? "selected" : "";
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
          <label className="col-sm-2 col-form-label">
            Status:
          </label>
          <div className="col-sm-10">
            <div className="btn-group ">
              <button type="button" className={`btn btn-primary-outline btn-emoji ${isSelected(0)}`} onClick={() => setStatus(0)}>😔</button>
              <button type="button" className={`btn btn-primary-outline btn-emoji ${isSelected(1)}`} onClick={() => setStatus(1)}>🙁</button>
              <button type="button" className={`btn btn-primary-outline btn-emoji ${isSelected(2)}`} onClick={() => setStatus(2)}>😐</button>
              <button type="button" className={`btn btn-primary-outline btn-emoji ${isSelected(3)}`} onClick={() => setStatus(3)}>🙂</button>
              <button type="button" className={`btn btn-primary-outline btn-emoji ${isSelected(4)}`} onClick={() => setStatus(4)}>😀</button>
            </div>
          </div>
          <label className="col-sm-2 col-form-label">
            Comment why:
          </label>
          <div className="col-sm-10">
            <textarea name="comment" id="comment" className="form-control" value={state.comment} onChange={handleCommentChange} />
          </div>
          <label className="col-sm-2 col-form-label">
            What did I do:
          </label>
          <div className="col-sm-10">
            <span>
              <input className="hobby-check" type="checkbox" name="run" value="run" onClick={(e) => setActivity(e.target.checked, "run")}/>
              <label className="hobby-check"htmlFor="run">Run</label>
            </span>
            <span>
              <input type="checkbox" name="shoot-arrows" onClick={(e) => setActivity(e.target.checked, "bow")}/>
              <label htmlFor="shoot-arrows">Shoot arrows</label>
            </span>
            <span>
              <input type="checkbox" name="lift" onClick={(e) => setActivity(e.target.checked, "lift")}/>
              <label htmlFor="lift">Gym</label>
            </span>
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
