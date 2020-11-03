import React, { Component } from 'react'
import axios from 'axios';
import {BASE_API_URL} from '../config';
class TitleComponent extends Component {


    componentWillMount() {
        axios.get(`${BASE_API_URL}/api/ping`)
            .then(() => console.log('Ok'))
            .catch(function (error) {
                console.log('hey', error);
            });

    }

    render() {
        return <h1>My.Feeling</h1>;
    }
}

export default TitleComponent;
