/* eslint global-require: 0 */
import React, { Component, PropTypes } from 'react';
import Helmet from 'react-helmet';
import helmetDefaults from 'utils/helmet';
import Link from 'react-router/lib/Link';
import IndexLink from 'react-router/lib/IndexLink';
import AppLayout, { Content } from 'components/app-layout';
import Navigation from 'components/navigation';

// Check if we should show devtool
const showDevTool = (process.env.NODE_ENV !== 'production');

// Otherwise render null
const DevTools = showDevTool ? require('utils/devtools') : () => null;

/**
 * Main app container
 * @return {Component}
 */
export default class App extends Component {

  static propTypes = {
    children: PropTypes.node.isRequired,
  };

  /**
   * Render Method
   * @return {Component}
   */
  render() {
    const { children } = this.props;

    return (
      <AppLayout>
        <Helmet {...helmetDefaults} />

        <Content>
          {children}
        </Content>

        <DevTools />
      </AppLayout>
    );
  }
}
