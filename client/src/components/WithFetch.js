import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from "axios";
import {useAuth0} from "@auth0/auth0-react";
import config from "../config";

const WithFetch = (props) => {
  const { user, getAccessTokenSilently } = useAuth0();
  const [data, setData] = useState({});
  const [isFetching, setIsFetching] = useState(true);

  const fetch = async () => {
    const token = await getAccessTokenSilently({
      audience: config.AUD,
    });
    const response = await axios.get(props.url,
      {
        headers: {
          "x-user-id": user.sub,
          Authorization: `Bearer ${token}`,
        }
      });

      setData(response.data);
      setIsFetching(false);
  }

  useEffect(() => {
    fetch();
  }, [props.update])


  return props.render({data, isFetching})
}

WithFetch.propTypes = {
  render: PropTypes.func.required,
  url: PropTypes.string,
  update: PropTypes.number.required,
}

export default WithFetch;
