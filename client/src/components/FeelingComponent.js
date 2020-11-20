import React, { useState, useEffect } from 'react'
import axios from 'axios';
import FeelingtHistoryComponent from './FeelingtHistoryComponent';
import {BASE_API_URL} from '../config';
import {useAuth0} from "@auth0/auth0-react";
import Profile from "./UserDetailsComponent";
import WithFetch from "./WithFetch";

const FeelingComponent  = ()  =>{
    const auth = useAuth0();
  const [update, forceUpdate] = useState(0)
  const [state, setState] = useState({
      status: 0,
      createdAt: '',
      comment: '',
    });

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
        .then((res) => {
          console.log('Calling set state')
          return forceUpdate(n => n+1);
        })
        .catch(e => console.log('Error', e))
  }

  return (
    <div className="App-tile">
      {console.log('Rendering')}
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
              <button type="button" className="btn btn-primary-outline btn-emoji" onClick={() => setStatus(0)}>😔</button>
              <button type="button" className="btn btn-primary-outline btn-emoji" onClick={() => setStatus(1)}>🙁</button>
              <button type="button" className="btn btn-primary-outline btn-emoji" onClick={() => setStatus(2)}>😐</button>
              <button type="button" className="btn btn-primary-outline btn-emoji" onClick={() => setStatus(3)}>🙂</button>
              <button type="button" className="btn btn-primary-outline btn-emoji" onClick={() => setStatus(4)}>😀</button>
            </div>
          </div>
          <label className="col-sm-2 col-form-label">
            Comment why:
          </label>
          <div className="col-sm-10">
            <textarea name="comment" id="comment" className="form-control" value={state.comment} onChange={handleCommentChange} />
          </div>
      </form>
      <div className="btn-container">
        <button type="button" onClick={handleSubmit} className="btn btn-success">Save</button>
      </div>
      <br />
      <WithFetch
        update={update}
        url={`${BASE_API_URL}/api/feelings`}
        render={({data, isFetching}) => (<FeelingtHistoryComponent data={data} isFetching={isFetching}/>)}
      />
    </div>
  );
}

export default FeelingComponent;
