import React, { Component } from 'react'
class TitleComponent extends Component {
    render() {
        return (
          <div className="d-flex justify-content-center">
            <div className="spinner-border" role="status">
              <span className="sr-only">Loading...</span>
            </div>
          </div>

        )
    }
}

export default TitleComponent;
