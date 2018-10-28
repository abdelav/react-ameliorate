import React                                          from 'react';
import { areObjectsEqualShallow, bindPrototypeFuncs } from './utils';

export default class ReactComponentBase extends React.Component {
  static proxyComponentInstanceMethod(propName) {
    if (propName in React.Component.prototype)
      return false;

    if (propName in ReactComponentBase.prototype)
      return false;

    return !(/^(componentWillMount|componentDidMount|componentWillUnmount|componentWillReceiveProps|shouldComponentUpdate|componentWillUpdate|render|componentDidUpdate|componentDidCatch|constructor|construct|getMountState|measure)$/).test(propName);
  }

  constructor(InstanceClass, props, ...args) {
    if (typeof InstanceClass !== 'function')
      throw new TypeError('ReactComponentBase expected a class/function as the last constructor argument but didn\'t receive one');

    super(props, ...args);

    var instance = new InstanceClass(props, this),
        state = this.state = {};

    bindPrototypeFuncs.call(instance, InstanceClass.prototype, instance);
    bindPrototypeFuncs.call(instance, InstanceClass.prototype, this, (...args) => {
      if (typeof this.constructor.proxyComponentInstanceMethod === 'function')
        return this.constructor.proxyComponentInstanceMethod(...args);

      return true;
    });

    Object.defineProperties(this, {
      '_renderCount': {
        writable: true,
        enumerable: false,
        configurable: true,
        value: 0
      },
      '_componentInstance': {
        enumerable: false,
        configurable: true,
        get: () => instance,
        set: () => {}
      },
      '_mounted': {
        writable: true,
        enumerable: false,
        configurable: true,
        value: false
      },
      '_propUpdateCounter': {
        writable: true,
        enumerable: false,
        configurable: true,
        value: 0
      },
      '_stateUpdateCounter': {
        writable: true,
        enumerable: false,
        configurable: true,
        value: 0
      }
    });

    instance._construct(InstanceClass, instance, props);
  }

  _updateInstanceProps(newProps, newState) {
    this._propUpdateCounter++;
    this._componentInstance._invokeResolveState(false, newProps, this.props);
  }

  shouldComponentUpdate(nextProps, nextState) {
    // Props have changed... update componentInstance
    var propsDiffer = !areObjectsEqualShallow(nextProps, this.props),
        statesDiffer = !areObjectsEqualShallow(nextState, this.state);

    if (!propsDiffer && !statesDiffer)
      return false;

    if (propsDiffer)
      this._updateInstanceProps(nextProps, nextState);

    if (statesDiffer)
      this._stateUpdateCounter++;

    return true;
  }

  componentDidMount() {
    this._mounted = true;
    this._componentInstance._invokeComponentDidMount();
  }

  componentWillUnmount() {
    this._mounted = false;
    this._componentInstance._invokeComponentWillUnmount();
  }

  render() {
    var renderID = `${this._propUpdateCounter}/${this._stateUpdateCounter}`;

    this._componentInstance._invalidateRenderCache();

    var elems = this._componentInstance._renderInterceptor(renderID);

    this._componentInstance._previousRenderID = renderID;
    this._renderCount++;

    return elems;
  }
}
