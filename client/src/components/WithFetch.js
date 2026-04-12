import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import axios from "axios";
import {useAuth0} from "@auth0/auth0-react";
import config from "../config";

const DEFAULT_POLL_INTERVAL_MS = 15000;
const CLIENT_DEV_URL = 'http://localhost:3000';

const mockFeelings = [
  {
    activities: { bow: false, lift: false, run: false, cycle: false, swim: false },
    status: '1',
    createdAt: '2020-12-10T21:26:45.996Z',
    comment: "Had an argument with Ana, not really feeling good about our relationship. Too much criticism from her.",
    userID: 'google-oauth2|100122194279033713808',
  },
  {
    activities: { bow: false, lift: false, run: false, cycle: false, swim: false },
    status: '4',
    createdAt: '2020-11-18T22:24:07.397Z',
    comment: 'Hit the gym today feeling pretty good. Had sex yesterday, working in the office',
    userID: 'google-oauth2|100122194279033713808',
  },
  {
    activities: { bow: false, lift: false, run: false, cycle: false, swim: false },
    status: '2',
    createdAt: '2021-04-16T00:17:16.137Z',
    comment: 'Meh. Not sure what will happen in the next few weeks in my relationship',
    userID: 'google-oauth2|100122194279033713808',
  },
  {
    activities: { bow: false, lift: false, run: false, cycle: false, swim: false },
    status: '4',
    createdAt: '2021-06-22T03:47:05.577Z',
    comment: 'Feeling really good. Ana and I worked out some issues and we both are happy. Need to ge back to archery',
    userID: 'google-oauth2|100122194279033713808',
  },
  {
    activities: { bow: false, lift: false, run: false, cycle: false, swim: false },
    status: '2',
    createdAt: '2020-11-12T22:56:58.752Z',
    comment: "There is a problem in the room that we booked for Vic's birthday and it is stressing me out.",
    userID: 'google-oauth2|100122194279033713808',
  },
  {
    activities: { bow: false, lift: false, run: false, cycle: false, swim: false },
    status: '3',
    createdAt: '2021-03-30T23:16:48.133Z',
    comment: "Back is getting better. I was able to go to the gym yesterday and also didn't eat any sugar yesterday too. ",
    userID: 'google-oauth2|100122194279033713808',
  },
  {
    activities: { bow: false, lift: false, run: false, cycle: false, swim: false },
    status: '4',
    createdAt: '2020-11-16T01:55:37.132Z',
    comment: 'Exercised a lot this morning, so I have a positive feeling about things. The ANZ interview is stressing me out a bit though.',
    userID: 'google-oauth2|100122194279033713808',
  },
  {
    activities: { bow: false, lift: false, run: false, cycle: false, swim: false },
    status: '2',
    createdAt: '2021-03-02T22:11:49.563Z',
    comment: 'Not sure why but I am feeling no motivation to get out of bed, hurting my back consistently and not feeling good about myself.',
    userID: 'google-oauth2|100122194279033713808',
  },
];

const WithFetch = (props) => {
  const { user, getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [data, setData] = useState([]);
  const [isFetching, setIsFetching] = useState(true);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !user?.sub) {
      return;
    }

    try {
      setIsFetching((previousState) => previousState && data.length === 0);
      const token = await getAccessTokenSilently({
        audience: config.AUD,
      });

      const response = await axios.get(props.url, {
        headers: {
          "x-user-id": user.sub,
          Authorization: `Bearer ${token}`,
        }
      });

      setData(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      if (window.location.origin === CLIENT_DEV_URL) {
        setData(mockFeelings);
      } else {
        console.log('Error fetching data', error);
      }
    } finally {
      setIsFetching(false);
    }
  }, [data.length, getAccessTokenSilently, isAuthenticated, props.url, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData, props.myUpdate]);

  useEffect(() => {
    if (!isAuthenticated) {
      return undefined;
    }

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      fetchData();
    }, DEFAULT_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchData, isAuthenticated]);

  return props.render({data, isFetching})
}

WithFetch.propTypes = {
  render: PropTypes.func,
  url: PropTypes.string,
  myUpdate: PropTypes.number,
}

export default WithFetch;
