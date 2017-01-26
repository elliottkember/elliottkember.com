import React, { Component } from 'react';
import classnames from 'classnames';
import s from './Homepage.scss';

export default class Homepage extends Component {

  constructor() {
    super();
    this.state = { hue: 50 };
  }

  componentDidMount() {
    const diff = 5;
    this.interval = setInterval(() => {
      this.setState({ hue: this.state.hue + diff });
    }, 50);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  render() {
    const hue = this.state.hue;
    const offset = 60;
    const size = 60;
    const saturation = 70;
    const lightness = 50;
    const leds = 12;

    return (
      <div>
        <div className={s.border} />
        <div className={s.sections}>
          <div className={classnames(s.section)}>
            <p>hello <br />
              I am Elliott
            </p>
          </div>

          <div className={classnames(s.section)}>
            <p>I make software</p>
          </div>

          <div className={classnames(s.section)}>
            <div className={classnames(s.firstLeds, s.leds)}>
              {[...Array(leds)].map((e, n) =>
                <div
                  className={s.led}
                  style={{
                    boxShadow: `1px 1px ${size}px 20px hsl(${hue + offset * (n - 1)}, ${saturation}%, ${lightness}%)`,
                    width: `${100 / leds}%`,
                    opacity: 0.6,
                  }}
                />
              )}
            </div>
            <p>and art</p>
            <div className={classnames(s.secondLeds, s.leds)}>
              {[...Array(leds)].map((e, n) =>
                <div
                  className={s.led}
                  style={{
                    boxShadow: `1px 1px ${size}px 20px hsl(${hue + offset * (n - 1)}, ${saturation}%, ${lightness}%)`,
                    width: `${100 / leds}%`,
                    opacity: 0.6,
                  }}
                />
              )}
            </div>
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

          <div className={classnames(s.section)}>
            <p>
              The website is over why are you still here
            </p>
          </div>
        </div>
      </div>
    );
  }
}
