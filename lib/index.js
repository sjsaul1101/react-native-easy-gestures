import React, { Component } from 'react';
import PropTypes from 'prop-types';
import R from 'ramda';

import { PanResponder, View, Platform } from 'react-native';

// Utils
import { angle, distance } from './utils/math.js';
import {
  getAngle,
  getScale,
  getTouches,
  isMultiTouch,
} from './utils/events.js';

export default class Gestures extends Component {

  static propTypes = {
    children: PropTypes.element,
    // Behavior
    draggable: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.shape({
        x: PropTypes.bool,
        y: PropTypes.bool,
      }),
    ]),
    rotatable: PropTypes.bool,
    scalable: PropTypes.oneOfType([
      PropTypes.bool,
      PropTypes.shape({
        min: PropTypes.number,
        max: PropTypes.number,
      }),
    ]),
    panResponderThreshold: PropTypes.number,
    snapThreshold: PropTypes.number,
    scale: PropTypes.number,
    rotate: PropTypes.string,
    // Styles
    styles: PropTypes.object,
    // Callbacks
    onStart: PropTypes.func,
    onChange: PropTypes.func,
    onEnd: PropTypes.func,
    onMultyTouchStart: PropTypes.func,
    onMultyTouchChange: PropTypes.func,
    onMultyTouchEnd: PropTypes.func,
    onRelease: PropTypes.func, // Legacy
    onRotateStart: PropTypes.func,
    onRotateChange: PropTypes.func,
    onRotateEnd: PropTypes.func,
    onScaleStart: PropTypes.func,
    onScaleChange: PropTypes.func,
    onScaleEnd: PropTypes.func,
  };

  static defaultProps = {
    children: {},
    // Behavior
    draggable: true || {
      x: true,
      y: false,
    },
    rotatable: true,
    scalable: true || {
      min: 0.33,
      max: 2,
    },
    panResponderThreshold: 10,
    snapThreshold: 0,
    // Styles
    styles: {
      left: 0,
      top: 0,
      transform: [
        { rotate: '0deg' },
        { scale: 1 },
      ],
    },
    // Callbacks
    onStart: () => {},
    onChange: () => {},
    onEnd: () => {},
    onRelease: () => {}, // Legacy

    // New callbacks
    onMultyTouchStart: () => {},
    onMultyTouchChange: () => {},
    onMultyTouchEnd: () => {},
    onRotateStart: () => {},
    onRotateChange: () => {},
    onRotateEnd: () => {},
    onScaleStart: () => {},
    onScaleChange: () => {},
    onScaleEnd: () => {},
  }

  constructor(props) {
    super(props);
    let styles = Gestures.defaultProps.styles;
    if (props && props.styles ) {
      styles = {
        ...styles,
        ...props.styles
      };
    }
     styles = {
      ...styles,
      transform: styles.transform.map(t=>
        t.scale && props.scale ? {scale: props.scale} :
          t.rotate && props.rotate ? {rotate: props.rotate} :
            t),
      top: props.rotate === '180deg' && styles.height ? styles.height : styles.top,
      left: props.rotate === '90deg' && styles.width ? styles.width : styles.left,
    }
    this.state = { styles,
      isMultyTouchingNow: false,
      isRotatingNow: false,
      isScalingNow: false,
    };
  }


  componentWillMount() {
    this.pan = PanResponder.create({
      onPanResponderGrant: this.onMoveStart,
      onPanResponderMove: this.onMove,
      onPanResponderEnd: this.onMoveEnd,
      onPanResponderTerminate: () => true,
      onShouldBlockNativeResponder: () => true,
      onStartShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => true,
      onMoveShouldSetPanResponder: (event, gestureState) => gestureState.dx > this.props.panResponderThreshold && gestureState.dy > this.props.panResponderThreshold,
      onMoveShouldSetPanResponderCapture: (event, gestureState) => false,
    });
  }

  componentWillReceiveProps(nextProps) {
    this.updateProps(nextProps);
  }

  onDrag(event, gestureState) {
    const { initialStyles } = this;
    const { draggable } = this.props;

    const isObject = R.is(Object, draggable);

    const left = (isObject ? draggable.x : draggable)
      ? initialStyles.left + gestureState.dx
      : initialStyles.left;

    const top = (isObject ? draggable.y : draggable)
      ? initialStyles.top + gestureState.dy
      : initialStyles.top;

    this.dragStyles = { left, top };
  }

  onRotate = (event) => {
    const { onRotateStart, onRotateChange, rotatable } = this.props;
    const { isRotatingNow, styles } = this.state;

    const { initialTouches } = this;

    if (rotatable) {
      const currentAngle = angle(getTouches(event));
      const initialAngle = initialTouches.length > 1
        ? angle(initialTouches)
        : currentAngle;
      const newAngle = currentAngle - initialAngle;
      const diffAngle = this.prevAngle - newAngle;

      this.pinchStyles.transform.push({
        rotate: getAngle(event, styles, diffAngle),
      });

      this.prevAngle = newAngle;

      if (!isRotatingNow) {
        onRotateStart(event, styles);

        this.setState({ isRotatingNow: true });
      } else {
        onRotateChange(event, styles);
      }
    }
  }

  onScale = (event) => {
    const { onScaleStart, onScaleChange, scalable } = this.props;
    const { isScalingNow, styles } = this.state;
    const { initialTouches } = this;

    const isObject = R.is(Object, scalable);

    if (isObject || scalable) {
      const currentDistance = distance(getTouches(event));
      const initialDistance = distance(initialTouches);
      const increasedDistance = currentDistance - initialDistance;
      const diffDistance = this.prevDistance - increasedDistance;

      const min = isObject ? scalable.min : 0.33;
      const max = isObject ? scalable.max : 2;
      const scale = Math.min(Math.max(getScale(event, styles, diffDistance), min), max);

      this.pinchStyles.transform.push({ scale });
      this.prevDistance = increasedDistance;

      if (!isScalingNow) {
        onScaleStart(event, styles);

        this.setState({ isScalingNow: true });
      } else {
        onScaleChange(event, styles);
      }
    }
  }

  onMoveStart = (event) => {
    const { styles } = this.state;
    const { onMultyTouchStart, onStart } = this.props;

    const touches = getTouches(event);

    this.prevAngle = 0;
    this.prevDistance = 0;
    this.initialTouchesAngle = 0;
    this.pinchStyles = {};
    this.dragStyles = {};

    this.initialTouches = getTouches(event);
    this.initialStyles = styles;

    onStart(event, styles);

    if (touches.length > 1) {
      onMultyTouchStart(event, styles);

      this.setState({ isMultyTouchingNow: true });
    }
  }

  onMove = (event, gestureState) => {
    const { isMultyTouchingNow, styles } = this.state;
    const { onChange, onMultyTouchChange } = this.props;

    const { initialTouches } = this;

    const touches = getTouches(event);

    if (touches.length !== initialTouches.length) {
      this.initialTouches = touches;
    } else {
      this.onDrag(event, gestureState);
      this.onPinch(event);
    }

    if (isMultyTouchingNow) {
      onMultyTouchChange(event, styles);
    }

    this.updateStyles();

    onChange(event, styles);
  }

  onMoveEnd = (event) => {
    const {
      isMultyTouchingNow,
      isRotatingNow,
      isScalingNow,
      styles,
    } = this.state;
    const {
      onEnd,
      onMultyTouchEnd,
      onRelease, // Legacy
      onRotateEnd,
      onScaleEnd,
      snapThreshold, 
      rotatable
    } = this.props;
    
    if (rotatable && snapThreshold && this.prevAnagle) {
      const newAngle = [-360, -270, -180, -90, 0, 90, 180, 270, 360]
          .find(testAngle => testAngle - snapThreshold < this.prevAngle && testAngle + snapThreshold > this.prevAngle)
        || this.prevAngle;
       if ( newAngle !== this.prevAngle) {
        this.prevAngle = newAngle;
        this.pinchStyles = {transform: [{rotate: prevAngle}]};
        this.updateStyles();
      }
    }

    onEnd(event, styles);
    onRelease(event, styles); // Legacy

    if (isRotatingNow) {
      onRotateEnd(event, styles);
    }

    if (isScalingNow) {
      onScaleEnd(event, styles);
    }

    if (isMultyTouchingNow) {
      onMultyTouchEnd(event, styles);
    }

    this.setState({
      isRotatingNow: false,
      isScalingNow: false,
    });
  }

  onPinch = (event) => {
    if (isMultiTouch(event)) {
      this.pinchStyles = { transform: [] };
      this.onScale(event);
      this.onRotate(event);
    }
  }

  updateStyles = () => {
    const styles = {
      ...this.state.styles,
      ...this.dragStyles,
      ...this.pinchStyles,
    };

    this.updateNativeStyles(styles);
    this.setState({ styles });
    if (this.state.styles.left < 10){
      this.setState({
        styles.left : 0
      })
  }

  updateNativeStyles = (styles) => {
    this.view.setNativeProps({ styles });
  }
  
  updateProps = nextProps => {
    if ( nextProps.rotate !== this.props.rotate &&
      nextProps.rotate !== this.state.styles.transform.find(t=>t.rotate).rotate ) {
      this.setState( prevState => ({
        styles: {
          ...prevState.styles,
          transform: prevState.styles.transform.map(t=>t.rotate ? {rotate: nextProps.rotate} : t)
        }
      }));
    }
     if ( nextProps.scale !== this.props.scale &&
      nextProps.scale !== this.state.styles.transform.find(t=>t.scale).scale ) {
      this.setState(prevState => ({
        styles: {
          ...prevState.styles,
          transform: prevState.styles.transform.map(t=>t.scale ? {scale: nextProps.scale} : t)
        }
      }));
    }
  };

  render() {
    const { styles } = this.state;

    return (
      <View
        ref={(c) => { this.view = c; }}
        style={styles}
        {...this.pan.panHandlers}
      >
        {
          this.props.children
        }
      </View>
    );
  }
}
