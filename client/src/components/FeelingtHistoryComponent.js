import React, { useState } from 'react'
import moment from 'moment';
import {Button, Popover, PopoverHeader, PopoverBody} from "reactstrap";
import SpinnerComponent from "./SpinnerComponent";
import FeelingChartComponent from "./FeelingChartComponent";
// import FeelingChartComponent from "./FeelingChartComponent";

const FeelingHistoryComponent = ({data = [], isFetching}) => {
  const [commentRowToggle, setCommentRowToggle] = useState(null);

  const toggle = (id) => {
    if (commentRowToggle === id) {
      return setCommentRowToggle(null);
    }
    return setCommentRowToggle(id)
  };

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
  
  const renderActivitiePill = (activity, index) => {
    const classMap =  {
      bow: "bg-amber-500",
      lift: "bg-yellow-500",
      run: "bg-lime-500",
      swim: "bg-cyan-500",
      cycle: "bg-indigo-500",
    }

    return (
      <button className={`cursor-auto px-4 py-2 text-xs mr-1 rounded-full text-white ${classMap[activity]}`} key={index}>
        {activity}
      </button>
    )
  }

  const parseActivitiesToArray = (activities) => {
    return Object.entries(activities).filter(([k,v]) => v ?? k).map(([k,v]) => k);
  }

  const renderChevronButton = (id) => {
    const direction = commentRowToggle === id ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7";
    return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d={direction} />
    </svg>)
  }

  const renderTableContent = (feelings) => {
    return (
      <table className="table table-fixed">
          <tbody>
            <tr className="bg-sky-800 text-white">
              <th scope="col">Feeling</th>
              <th className="hidden md:table-cell" scope="col">Date</th>
              <th scope="col">Activities</th>
              <th scope="col"></th>
            </tr>
            {
              feelings.sort((a, b) => (new Date(b.createdAt) - new Date(a.createdAt))).map((f, i) => {
                const date = moment(new Date(f.createdAt)).format('DD-MM-YYYY');
                return (
                  <>
                <tr className="hover:bg-sky-700 hover:text-white hover:cursor-pointer" key={i} onClick={() => toggle(i)}>
                  <td className="p-0 text-2xl pl-1 pr-1 align-middle">{renderStatus(f.status)}</td>
                  <td className="hidden  md:table-cell">{date}</td>
                  <td className="">
                    {
                    parseActivitiesToArray(f.activities)
                      .map((e, i) => renderActivitiePill(e, i))
                    }
                  </td>
                  <td className="">{renderChevronButton(i)}</td>
                </tr>
                <tr className={`hover:bg-sky-700 hover:text-white ${commentRowToggle === i ? "table-row":"hidden"}`} key={i + 'description'}>
                  <td className="pl-2 pr-2 w-96 table-cell  md:hidden" colSpan={"3"}>{f.comment}</td>
                  <td className="pl-2 pr-2 w-96 hidden  md:table-cell" colSpan={"4"}>{f.comment}</td>
                </tr>
                  </>
                )
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

  const renderSpinner = () => (<SpinnerComponent />)

    // TODO: We need to curate the data before creating the chart because it got too slow with activities object
    return (
      <div>
        {isFetching ? renderSpinner() : ''}
        {/*{data && data.length && <FeelingChartComponent feelingHistory={data}/>}*/}
        <br/>
        {data && data.length && !isFetching ? renderTableContent(data) : renderEmptyTable() }
      </div>
    );
}

export default FeelingHistoryComponent;
