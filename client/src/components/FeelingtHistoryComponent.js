import React, { Component } from 'react'
import moment from 'moment';

const FeelingHistoryComponent = ({feelings}) => {


    const renderStatus = (s) => {
      switch (Number.parseInt(s)) {
        case 0:
          return (<span>😔</span>);
        case 1:
          return (<span>🙁</span>);
        case 2:
          return (<span>😐</span>);
        case 3:
          return (<span>🙂</span>);
        case 4:
          return (<span>😀</span>);

      }
    }
    const renderTableContent = (feelings) => {
      return (
        <table className="table table-striped">
            <tbody>
              <tr>
                <th scope="col">Feeling</th>
                <th scope="col">Date</th>
              </tr>
              {
                feelings.map((f, i) => {
                  const date = moment(new Date(f.createdAt)).format('DD-MM-YYYY');
                  return (<tr key={i}>
                  <td>{renderStatus(f.status)}</td>
                  <td>{date}</td>
                </tr>)
                })
               }
              </tbody>
        </table>
        )
    }

    const renderEmptyTable = () => {
      return (
        <div>No content</div>
      )
    }

  // render() {
    // const {feelings} = props;
      return (
        <div>
          {feelings ? renderTableContent(feelings) : renderEmptyTable() }
        </div>
      );
  // }
}

export default FeelingHistoryComponent;
