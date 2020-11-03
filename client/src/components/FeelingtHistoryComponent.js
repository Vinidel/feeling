import React, { Component } from 'react'

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
                  const [year, month, date] = new Date(f.createdAt).toISOString().substring(0,10).split('-')
                  return (<tr key={i}>
                  <td>{renderStatus(f.status)}</td>
                  <td>{`${date}/${month}/${year}`}</td>
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
