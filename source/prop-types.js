/**
 * Copyright (c) 2013-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Original source: https://github.com/facebook/prop-types
 * Heavily modified by eVisit, LLC
 */

const REACT_ELEMENT_TYPE = (typeof Symbol === 'function' && Symbol.for && Symbol.for('react.element')) || 0xeac7;
function isValidElement(object) {
  return (object !== null && typeof object === 'object' && object.$$typeof === REACT_ELEMENT_TYPE);
}

/* global Symbol */

function factory(isValidElement, throwOnDirectAccess) {
  const IS_DEVELOPMENT = (typeof process !== 'undefined' && process && process.env && process.env.NODE_ENV !== 'production'),
        REACT_CREATIVE_SECRET = 'SECRET_DO_NOT_PASS_THIS_OR_YOU_WILL_BE_FIRED',
        ITERATOR_SYMBOL = (typeof Symbol === 'function' && Symbol.iterator),
        FAUX_ITERATOR_SYMBOL = '@@iterator', // Before Symbol spec,
        ANONYMOUS = '<<anonymous>>',
        loggedTypeFailures = {};

  var printWarning = function() {};

  if (IS_DEVELOPMENT && typeof console !== 'undefined') {
    printWarning = function(text) {
      var message = 'Warning: ' + text;
      if (typeof console !== 'undefined')
        console.error(message);

      try {
        // --- Welcome to debugging React ---
        // This error was thrown as a convenience so that you can use this stack
        // to find the callsite that caused this warning to fire.
        throw new Error(message);
      } catch (x) {}
    };
  }

  /**
   * Returns the iterator method function contained on the iterable object.
   *
   * Be sure to invoke the function with the iterable as context:
   *
   *     var iteratorFunction = getIteratorFunction(myIterable);
   *     if (iteratorFunction) {
   *       var iterator = iteratorFunction.call(myIterable);
   *       ...
   *     }
   *
   * @param {?object} maybeIterable
   * @return {?function}
   */
  function getIteratorFunction(maybeIterable) {
    var iteratorFunction = (maybeIterable && (ITERATOR_SYMBOL && maybeIterable[ITERATOR_SYMBOL] || maybeIterable[FAUX_ITERATOR_SYMBOL]));
    if (typeof iteratorFunction === 'function')
      return iteratorFunction;
  }

  function isSymbol(propType, propValue) {
    return (propType === 'symbol' || propValue['@@toStringTag'] === 'Symbol' || (typeof Symbol === 'function' && propValue instanceof Symbol));
  }

  function getPropType(propValue) {
    if (propValue == null)
      return ('' + propValue);

    if (Array.isArray(propValue) || (propValue instanceof Array))
      return 'array';

    if (propValue instanceof RegExp)
      return 'regexp';

    if (propValue instanceof Date)
      return 'date';

    var propType = typeof ((typeof propValue.valueOf === 'function') ? propValue.valueOf() : propValue);
    if (isSymbol(propType, propValue))
      return 'symbol';

    return propType;
  }

  function getClassName(propValue) {
    if (propValue == null || !propValue.constructor || !propValue.constructor.name)
      return ANONYMOUS;

    return propValue.constructor.name;
  }

  function getPostfixForTypeWarning(value) {
    var type = getPropType(value);
    switch (type) {
      case 'array':
      case 'object':
        return 'an ' + type;
      case 'boolean':
      case 'date':
      case 'regexp':
        return 'a ' + type;
      default:
        return type;
    }
  }

  function allElementsAreValid(typeChecker, failOnInteratorError, props, propName, componentName, location, propFullName, secret) {
    var propValue = props[propName];
    if (propValue == null)
      return;

    // Is this just an array?
    if (Array.isArray(propValue) || (propValue instanceof Array)) {
      for (var i = 0, il = propValue.length; i < il; i++) {
        var ret = typeChecker(propValue, i, componentName, location, propFullName + ('[' + i + ']'), secret);
        if (ret)
          return ret;
      }

      return;
    }

    // Is it iteratable?
    var iteratorFunction = getIteratorFunction(propValue);
    if (!iteratorFunction)
      return failOnInteratorError;

    var iterator = iteratorFunction.call(propValue),
        step,
        tuples = (iteratorFunction === propValue.entries),
        index = 0,
        valueArray = [0];

    while (!(step = iterator.next()).done) {
      var value = step.value;
      if (tuples)
        value = value[1];

      valueArray[0] = value;
      var ret = typeChecker(valueArray, 0, componentName, location, propFullName + ('[' + index + ']'), secret);
      if (ret)
        return ret;

      index++;
    }

    return;
  }

  function isNodeInvalid(props, propName, ...args) {
    var propValue = props[propName],
        propType = getPropType(propValue);

    switch (propType) {
      case 'number':
      case 'string':
      case 'undefined':
      case 'null':
        return false;
      case 'boolean':
        return !!propValue;
      case 'array':
        return allElementsAreValid(isNodeInvalid, true, props, propName, ...args);
      case 'object':
        if (isValidElement(propValue))
          return false;

        return allElementsAreValid(isNodeInvalid, true, props, propName, ...args);
      default:
        return true;
    }
  }

  /**
   * inlined Object.is polyfill to avoid requiring consumers ship their own
   * https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/is
   */
  /*eslint-disable no-self-compare*/
  function areSame(x, y) {
    // SameValue algorithm
    if (x === y) {
      // Steps 1-5, 7-10
      // Steps 6.b-6.e: +0 != -0
      return (x !== 0 || (1 / x) === (1 / y));
    } else {
      // Step 6.a: NaN == NaN
      return (x !== x && y !== y);
    }
  }
  /*eslint-enable no-self-compare*/

  /**
   * We use an Error-like object for backward compatibility as people may call
   * PropTypes directly and inspect their output. However, we don't use real
   * Errors anymore. We don't inspect their stack anyway, and creating them
   * is prohibitively expensive if they are created too often, such as what
   * happens in oneOfType() for any type before the one that matched.
   */
  function PropTypeError(message) {
    this.message = message;
    this.stack = '';
  }
  // Make `instanceof Error` still work for returned errors.
  PropTypeError.prototype = Error.prototype;

  function createValidator(type, validator, _args) {
    function checkType(isRequired, props, propName, componentName, location, propFullName, secret) {
      if (secret !== REACT_CREATIVE_SECRET) {
        if (throwOnDirectAccess !== false) {
          var err = new Error(
            'Calling PropTypes validators directly is not supported by the `prop-types` package. ' +
            'Use `PropTypes.checkPropTypes()` to call them. ' +
            'Read more at http://fb.me/use-check-prop-types'
          );

          err.name = 'Invariant Violation';
          throw err;
        }

        if (!IS_DEVELOPMENT)
          return null;

        var cacheKey = componentName + ':' + propName;
        if (manualPropTypeCallCache[cacheKey] || manualPropTypeWarningCount >= 3)
          return;

        printWarning([
          'You are manually calling a React.PropTypes validation ',
          'function for the `', propFullName, '` prop on `', componentName, '`. This is deprecated ',
          'and will throw in the standalone `prop-types` package. ',
          'You may be seeing this warning due to a third-party PropTypes ',
          'library. See https://fb.me/react-warning-dont-call-proptypes ', 'for details.'
        ].join(''));

        manualPropTypeCallCache[cacheKey] = true;
        manualPropTypeWarningCount++;
      }

      if (!IS_DEVELOPMENT)
        return null;

      var fullPropName = propFullName || propName,
          propValue = props[propName];

      if (propValue == null) {
        if (isRequired)
          return new PropTypeError('The ' + location + ' `' + fullPropName + '` is marked as required ' + ('in `' + componentName + '`, but its value is `' + propValue + '`.'));
        else
          return;
      }

      var ret = validator.call(this, props, propName, componentName, location, fullPropName, secret);
      return (ret === undefined) ? null : ret;
    }

    var manualPropTypeCallCache = {},
        manualPropTypeWarningCount = 0,
        args = (_args) ? _args : [],
        context = { type: type, args: args, validator: validator };

    Object.defineProperty(checkType, '_context', {
      writable: false,
      enumerable: false,
      configurable: false,
      value: context
    });

    var checker = checkType.bind(context, false);
    checker.isRequired = checkType.bind(context, true);
    return checker;
  }

  function createValidatorWithArguments(type, validator, argumentValidator) {
    return function(..._args) {
      var args = _args;
      if (!args.length)
        throw new Error('Arguments required for PropTypes.' + type);

      if (args[args.length - 1] === REACT_CREATIVE_SECRET)
        throw new Error('Arguments required for PropTypes.' + type + ', yet PropTypes.' + type + ' was never called with any arguments');

      if (typeof argumentValidator === 'function')
        args = argumentValidator(type, args);

      return createValidator(type, validator, args);
    };
  }

  function createPrimitiveTypeValidator(type, expectedType, _exptectedTypeMessage) {
    var isExpectedTypeArray = (expectedType instanceof Array),
        expectedTypeMessage = (_exptectedTypeMessage) ? _exptectedTypeMessage : expectedType;

    return createValidator(type, function(props, propName, componentName, location, propFullName) {
      var propValue = props[propName],
          propType = getPropType(propValue);

      if (isExpectedTypeArray && expectedType.indexOf(propType) >= 0)
        return;
      else if (propType === expectedType)
        return;

      return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected ') + ('`' + expectedTypeMessage + '`.'));
    });
  }

  const any = createValidator('any', () => undefined),
        bool = createPrimitiveTypeValidator('bool', 'boolean'),
        number = createPrimitiveTypeValidator('number', 'number'),
        string = createPrimitiveTypeValidator('string', 'string'),
        symbol = createPrimitiveTypeValidator('symbol', 'symbol'),
        func = createPrimitiveTypeValidator('function', 'function'),
        array = createPrimitiveTypeValidator('array', 'array'),
        object = createPrimitiveTypeValidator('object', ['object', 'date', 'regexp', 'array'], 'object'),
        node = createValidator('node', function(props, propName, componentName, location, propFullName) {
          if (isNodeInvalid(props, propName, componentName, location, propFullName))
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`, expected a ReactNode.'));
        }),
        element = createValidator('element', function(props, propName, componentName, location, propFullName) {
          var propValue = props[propName];
          if (isValidElement(propValue))
            return;

          var propType = getPropType(propValue);
          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected a single ReactElement.'));
        }),
        instanceOf = createValidatorWithArguments('instanceOf', function(props, propName, componentName, location, propFullName) {
          var propValue = props[propName],
              instanceType = this.args[0];

          if (propValue !== null && (propValue instanceof instanceType))
            return;

          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + getClassName(propValue) + '` supplied to `' + componentName + '`, expected instance of `' + (instanceType.displayName || instanceType.name) + '`.'));
        }),
        oneOf = createValidatorWithArguments('oneOf', function(props, propName, componentName, location, propFullName) {
          var values = (this.args[0] || []);
          if (!values || !values.length)
            return;

          var propValue = props[propName];
          for (var i = 0, il = values.length; i < il; i++) {
            var value = values[i];
            if (areSame(value, propValue))
              return;
          }

          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of value ' + ('`' + propValue + '` supplied to `' + componentName + '`, expected one of ' + JSON.stringify(values) + '.'));
        }, (type, args) => {
          if (!(args[0] instanceof Array) && !Array.isArray(args[0])) {
            printWarning('Invalid argument supplied to oneOf, expected an instance of array.');
            return [];
          }

          return args;
        }),
        oneOfType = createValidatorWithArguments('oneOfType', function(props, propName, componentName, location, propFullName, secret) {
          var checkers = this.args[0];
          if (!checkers || !checkers.length)
            return;

          for (var i = 0, il = checkers.length; i < il; i++) {
            var checker = checkers[i];
            if (checker(props, propName, componentName, location, propFullName, secret) == null)
              return;
          }

          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
        }, (type, args) => {
          if (!args || getPropType(args[0]) !== 'array') {
            printWarning('Invalid argument supplied to oneOfType, expected an instance of array.');
            return [];
          }

          // Argument checker (ensure all arguments are type checkers)

          var params = args[0];
          for (var i = 0, il = params.length; i < il; i++) {
            var checker = params[i];
            if (typeof checker !== 'function') {
              printWarning([
                'Invalid argument supplied to oneOfType',
                '. Expected an array of check functions, but ',
                'received ',
                getPostfixForTypeWarning(checker),
                ' at index ',
                i,
                '.'
              ].join(''));

              return [];
            }
          }

          return args;
        }),
        arrayOf = createValidatorWithArguments('oneOfType', function(props, propName, componentName, location, propFullName, secret) {
          var propValue = props[propName],
              typeChecker = this.args[0];

          if (typeof typeChecker !== 'function')
            return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside arrayOf.');

          if (Array.isArray(propValue) || (propValue instanceof Array)) {
            var error = allElementsAreValid(typeChecker, undefined, props, propName, componentName, location, propFullName, secret);

            if (error)
              return error;
            else
              return;
          } else {
            var propType = getPropType(propValue);
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an array.'));
          }

          return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` supplied to ' + ('`' + componentName + '`.'));
        }),
        objectOf = createValidatorWithArguments('objectOf', function(props, propName, componentName, location, propFullName, secret) {
          var propValue = props[propName],
              propType = getPropType(propValue),
              typeChecker = this.args[0];

          if (typeof typeChecker !== 'function')
            return new PropTypeError('Property `' + propFullName + '` of component `' + componentName + '` has invalid PropType notation inside objectOf.');

          if (propType !== 'object')
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type ' + ('`' + propType + '` supplied to `' + componentName + '`, expected an object.'));

          var keys = Object.keys(propValue);
          for (var i = 0, il = keys.length; i < il; i++) {
            var key = keys[i],
                error = typeChecker(propValue, key, componentName, location, propFullName + '.' + key, secret);

            if (error)
              return error;
          }
        }),
        exact = createValidatorWithArguments('shape', function(props, propName, componentName, location, propFullName, secret) {
          var propValue = props[propName],
              propType = getPropType(propValue),
              shapeObj = this.args[0],
              mustBeExact = this.args[1];

          if (propType !== 'object')
            return new PropTypeError('Invalid ' + location + ' `' + propFullName + '` of type `' + propType + '` ' + ('supplied to `' + componentName + '`, expected `object`.'));

          var keys = Object.keys(Object.assign({}, propValue, shapeObj));
          for (var i = 0, il = keys.length; i < il; i++) {
            var key = keys[i],
                checker = shapeObj[key];

            if (!checker) {
              if (mustBeExact !== false) {
                return new PropTypeError([
                  'Invalid ', location, ' `', propFullName, '` key `', key, '` supplied to `', componentName, '`.',
                  '\nBad object: ', JSON.stringify(props[propName], null, '  '),
                  '\nValid keys: ', JSON.stringify(Object.keys(shapeObj), null, '  ')
                ].join(''));
              } else {
                continue;
              }
            }

            var error = checker(propValue, key, componentName, location, propFullName + '.' + key, secret);
            if (error)
              return error;
          }
        }, (type, args) => {
          var propType = getPropType(args[0]);
          if (propType !== 'object') {
            printWarning([
              'Invalid argument supplied to shape. Expected an object of check functions, but ',
              'received ', getPostfixForTypeWarning(args[0]), ' instead.'
            ].join(''));
          }

          return [args[0], args[1]];
        }),
        shape = createValidatorWithArguments('shape', function(props, propName, componentName, location, propFullName, secret) {
          var exactChecker = this.args[0];
          return exactChecker(props, propName, componentName, location, propFullName, secret);
        }, (type, args) => {
          return [exact(args[0], false)];
        }),
        customProp = createValidatorWithArguments(),
        customArrayProp = createValidatorWithArguments(),
        checkPropTypes = function(typeSpecs, props, location, componentName, getStack) {
          if (!IS_DEVELOPMENT)
            return;

          var keys = Object.keys(typeSpecs);
          for (var i = 0, il = keys.length; i < il; i++) {
            var typeSpecName = keys[i],
                thisTypeSpec = typeSpecs[typeSpecName],
                error;

            // Prop type validation may throw. In case they do, we don't want to
            // fail the render phase where it didn't fail before. So we log it.
            // After these have been cleaned up, we'll let them throw.
            try {
              // This is intentionally an invariant that gets caught. It's the same
              // behavior as without this statement except with a better message.
              if (typeof thisTypeSpec !== 'function') {
                var err = Error([
                  (componentName || 'React class'), ': ', location, ' type `', typeSpecName, '` is invalid; ',
                  'it must be a function, usually from the `prop-types` package, but received `', typeof thisTypeSpec, '`.'
                ].join(''));

                err.name = 'Invariant Violation';
                throw err;
              }

              error = thisTypeSpec(props, typeSpecName, componentName, location, null, REACT_CREATIVE_SECRET);
            } catch (ex) {
              error = ex;
            }

            if (error && !(error instanceof Error)) {
              printWarning([
                (componentName || 'React class'),
                ': type specification of ', location, ' `',
                typeSpecName, '` is invalid; the type checker ',
                'function must return `null` or an `Error` but returned a ', typeof error, '. ',
                'You may have forgotten to pass an argument to the type checker ',
                'creator (arrayOf, instanceOf, objectOf, oneOf, oneOfType, and ',
                'shape all require an argument).'
              ].join(''));
            }

            if ((error instanceof Error) && !loggedTypeFailures.hasOwnProperty(error.message)) {
              // Only monitor this failure once because there tends to be a lot of the
              // same error.
              loggedTypeFailures[error.message] = true;

              var stack = getStack ? getStack() : '';
              printWarning(['Failed ', location, ' type: ', error.message, (stack != null) ? stack : ''].join(''));
            }
          }
        };

  return {
    any,
    bool,
    number,
    string,
    symbol,
    func,
    array,
    object,
    node,
    element,
    instanceOf,
    oneOf,
    oneOfType,
    arrayOf,
    objectOf,
    shape,
    exact,
    customProp,
    customArrayProp,
    checkPropTypes
  };
}

// Add default PropTypes properties for the factory function for use with direct import
Object.assign(factory, factory(isValidElement));

module.exports = factory;
