import React, { Component } from 'react'
import axios from 'axios';
import {BASE_API_URL} from '../config';
class PingComponent extends Component {

    constructor() {
        super();
        this.state = {
            pong: 'pending'
        }
    }

    componentWillMount() {
        axios.get(`${BASE_API_URL}/api/ping`)
            .then((response) => {
                this.setState(() => {
                    return { pong: response.data.message }
                })
            })
            .catch(function (error) {
                console.log('hey', error);
            });

    }

    render() {
        return <h1>Ping  {this.state.pong}</h1>;
    }
}

export default PingComponent; 