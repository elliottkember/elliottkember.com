import React, { Component } from 'react';
import Helmet from 'react-helmet';
import Segment from 'components/segment';
import Button from 'components/button';
import Homepage from 'components/homepage';

export default class Home extends Component {
  render() {
    return (
      <div>
        <Helmet title="Home" />
        <Homepage />
      </div>
    );
  }
}
