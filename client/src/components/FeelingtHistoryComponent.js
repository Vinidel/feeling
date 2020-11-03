import React, { Component } from 'react'

class FeelingHistoryComponent extends Component {

    renderTableContent = (feelings) => {
      return (
        <table className="table table-striped">
            <tbody>
              <tr>
                <th scope="col">Feeling</th>
                <th scope="col">Date</th>
              </tr>
              {
                feelings.map((weight, i) => {
                  const [year, month, date] = new Date(weight.createdAt).toISOString().substring(0,10).split('-')
                  return (<tr key={i}>
                  <td>{weight.kilograms}</td>
                  <td>{`${date}/${month}/${year}`}</td>
                </tr>)
                })
               }
              </tbody>
        </table>
        )
    }

    renderEmptyTable = () => {
      return (
        <div>No content</div>
      )
    }

  render() {
    const {feelings} = this.props;
      return (
        <div>
          {feelings ? this.renderTableContent(feelings) : this.renderEmptyTable() }
        </div>
      );
  }
}

export default FeelingHistoryComponent;
