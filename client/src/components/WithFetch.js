import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from "axios";
import {useAuth0} from "@auth0/auth0-react";


const WithFetch = (props) => {
  const { user } = useAuth0();
  const [data, setData] = useState({});
  const [isFetching, setIsFetching] = useState(true);

  const fetch = () => {
    axios.get(props.url,
      {
        headers: {
          "x-user-id": user.sub
        }
      }).then((response) => {
      setData(response.data);
      setIsFetching(false);
    })
  }

  useEffect(() => {
    fetch();
  }, [])

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
