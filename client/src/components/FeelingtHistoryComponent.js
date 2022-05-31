import React, { useState } from 'react'
import moment from 'moment';
import {Button, Popover, PopoverHeader, PopoverBody} from "reactstrap";
import SpinnerComponent from "./SpinnerComponent";
import FeelingChartComponent from "./FeelingChartComponent";
// import FeelingChartComponent from "./FeelingChartComponent";

const FeelingHistoryComponent = ({data = [], isFetching}) => {
  const [popoverOpen, setPopoverOpen] = useState(null);

  const renderIcon = (comment, date, id) => {
    const toggle = () => {
      if (popoverOpen === id) {
        return setPopoverOpen(null);
      }
      return setPopoverOpen(id)
    };

    return (
      <div key={id}>
        <Button className="comment-link" id={'comment-btn' + id} type="button">
          <svg width="1em" height="1em" viewBox="0 0 16 16" className="bi bi-book" fill="currentColor"
               xmlns="http://www.w3.org/2000/svg">
            <path fill-rule="evenodd"
                  d="M1 2.828v9.923c.918-.35 2.107-.692 3.287-.81 1.094-.111 2.278-.039 3.213.492V2.687c-.654-.689-1.782-.886-3.112-.752-1.234.124-2.503.523-3.388.893zm7.5-.141v9.746c.935-.53 2.12-.603 3.213-.493 1.18.12 2.37.461 3.287.811V2.828c-.885-.37-2.154-.769-3.388-.893-1.33-.134-2.458.063-3.112.752zM8 1.783C7.015.936 5.587.81 4.287.94c-1.514.153-3.042.672-3.994 1.105A.5.5 0 0 0 0 2.5v11a.5.5 0 0 0 .707.455c.882-.4 2.303-.881 3.68-1.02 1.409-.142 2.59.087 3.223.877a.5.5 0 0 0 .78 0c.633-.79 1.814-1.019 3.222-.877 1.378.139 2.8.62 3.681 1.02A.5.5 0 0 0 16 13.5v-11a.5.5 0 0 0-.293-.455c-.952-.433-2.48-.952-3.994-1.105C10.413.809 8.985.936 8 1.783z"/>
          </svg>
        </Button>
        <Popover placement="top" isOpen={popoverOpen === id} target={'comment-btn' + id} toggle={toggle}>
          <PopoverHeader>{moment(new Date(date)).format('MMMM Do YYYY, h:mm:ss a')}</PopoverHeader>
          <PopoverBody >{comment}</PopoverBody>
        </Popover>
      </div>)
  }

  const renderEmpty = () => (<span></span>)

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
        <table className="table table-striped table-auto">
            <tbody>
              <tr>
                <th scope="col">Feeling</th>
                <th scope="col">Date</th>
                <th scope="col">Comment</th>
              </tr>
              {
                feelings.sort((a, b) => (new Date(b.createdAt) - new Date(a.createdAt))).map((f, i) => {
                  const date = moment(new Date(f.createdAt)).format('DD-MM-YYYY');
                  return (<tr key={i}>
                  <td>{renderStatus(f.status)}</td>
                  <td>{date}</td>
                  <td className="popover-icon">{f.comment ? renderIcon(f.comment, f.createdAt, i) : renderEmpty()}</td>
                </tr>)
                })
               }
              </tbody>
        </table>
        )
    }

  // const renderChart = (data) => (<FeelingChartComponent feelingHistory={data}/>)

  const renderEmptyTable = () => {
      return (
        <div>No content</div>
      )
    }

    const renderSpinner = () => (<SpinnerComponent />)

      return (
        <div>
          {isFetching ? renderSpinner() : ''}
          {data && data.length && <FeelingChartComponent feelingHistory={data}/>}
          {data && data.length && !isFetching ? renderTableContent(data) : renderEmptyTable() }
          {/*{data && !isFetching ? renderChart(data) : "" }*/}

        </div>
      );
}

export default FeelingHistoryComponent;
