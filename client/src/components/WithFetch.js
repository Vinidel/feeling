import { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import axios from "axios";
import {useAuth0} from "@auth0/auth0-react";
import config from "../config";

const DEFAULT_POLL_INTERVAL_MS = 15000;

const WithFetch = (props) => {
  const { user, getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [data, setData] = useState([]);
  const [isFetching, setIsFetching] = useState(true);

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !user?.sub) {
      return;
    }

    try {
      setIsFetching(true);
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
      console.log('Error fetching data', error);
    } finally {
      setIsFetching(false);
    }
  }, [getAccessTokenSilently, isAuthenticated, props.url, user]);

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
