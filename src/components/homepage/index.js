import React, { Component } from 'react';
import classnames from 'classnames';
import s from './Homepage.scss';

export default class Homepage extends Component {

  render() {
    return (
      <div>
        <div className={classnames(s.section)}>
          <p>hello <br />
            I am Elliott
          </p>
        </div>

        <div className={classnames(s.section)}>
          <p>I make things</p>
        </div>

        <div className={classnames(s.section)}>
          <p>like software</p>
        </div>

        <div className={classnames(s.section)}>
          <p>and art</p>
        </div>

        <div className={classnames(s.section)}>
          <p>and jokes</p>
        </div>

        <div className={classnames(s.section)}>
          <p>I work at ueno.</p>
        </div>

        <div className={classnames(s.section)}>
          <p>(I also have worked at other places)</p>
        </div>

        <div className={classnames(s.section)}>
          <p>
            Talk to me<br />
            elliott.kember@gmail.com
          </p>
        </div>
      </div>
    );
  }
}
