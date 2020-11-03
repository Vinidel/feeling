import React, { useState, useEffect } from 'react'
import axios from 'axios';
import FeelingtHistoryComponent from './FeelingtHistoryComponent';
import SpinnerComponent from './SpinnerComponent';
import {BASE_API_URL} from '../config';
import {useAuth0} from "@auth0/auth0-react";
import Profile from "./UserDetailsComponent";

const FeelingComponent  = ()  =>{
    const auth = useAuth0();
    // const { user, isAuthenticated, isLoading } = useAuth0();

  const [state, setState] = useState({
      fetching: true,
      status: 0,
      createdAt: '',
      comment: '',
      history: [],
    });

    const getFeelings = () => {
      axios.get(`${BASE_API_URL}/api/feelings`,
        {
          headers: {
            "x-user-id": auth.user.sub
          }
        })
      .then((response) => {
          setState((prevState) => {
              return {
                ...prevState,
                history: response.data,
                fetching: false
              }
          })
      })
      .catch(function (error) {
          console.log('hey', error);
      });
    }

    useEffect(() => {
      getFeelings()
    }, [])

    const setStatus = (status) => {
      setState((prevState) => {
        return {
          ...prevState,
          status,
          createdAt: new Date().toISOString(),
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

    const handleSubmit = (e) => {
      e.preventDefault();
      console.log('State', state);
      return axios.post(`${BASE_API_URL}/api/feelings`,
        {
          status: state.status.toString(),
          createdAt: state.createdAt,
          comment: state.comment,

        }, {
          headers: {
            "x-user-id": auth.user.sub
          }
        })
        .then((res) => console.log('Success'))
        .then(getFeelings)
        .catch(e => console.log('Error', e))
  }

  const renderSpinner = () => (<SpinnerComponent />)

  const renderWeightHistory = () => {
    return <FeelingtHistoryComponent feelings={state.history}/>;
  }

  return (
    <div className="App-tile">
      <Profile />
      <button onClick={() => auth.logout({ returnTo: window.location.origin })}>
        Log Out
      </button>
      <form className="form-group row">
          <label className="col-sm-2 col-form-label">
            Status:
          </label>
          <div className="col-sm-10">
            <div className="btn-group ">
              <button type="button" className="btn btn-primary-outline" onClick={() => setStatus(0)}>😔</button>
              <button type="button" className="btn btn-primary-outline" onClick={() => setStatus(1)}>🙁</button>
              <button type="button" className="btn btn-primary-outline" onClick={() => setStatus(2)}>😐</button>
              <button type="button" className="btn btn-primary-outline" onClick={() => setStatus(3)}>🙂</button>
              <button type="button" className="btn btn-primary-outline" onClick={() => setStatus(4)}>😀</button>
            </div>
          </div>
          <label className="col-sm-2 col-form-label">
            Comment why:
          </label>
          <div className="col-sm-10">
            <textarea name="comment" id="comment" className="form-control" value={state.comment} onChange={handleCommentChange} />
            {/*<textarea name="comment" id="comment" className="form-control" onChange={handleCommentChange} />*/}
          </div>
      </form>
      <div className="btn-container">
        <button type="button" onClick={handleSubmit} className="btn btn-success">Save</button>
      </div>
      <br />
      {state.fetching ? renderSpinner() : renderWeightHistory()}
    </div>
  );
}

export default FeelingComponent;
