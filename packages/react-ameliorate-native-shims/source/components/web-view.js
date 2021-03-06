"use strict";

//###if(MOBILE) {###//
import { WebView }      from 'react-native';
//###} else {###//
import { View }         from './view';
import WebViewPropTypes from '../prop-types/web-view';

class WebView extends View {
  static propTypes = WebViewPropTypes;
  static defaultProps = {
    javaScriptEnabled: true,
    thirdPartyCookiesEnabled: true,
    scalesPageToFit: true,
    saveFormDataDisabled: false
  };

  getProps(providedProps) {
    var props = super.getProps(providedProps),
        source = props.source;

    if (source && source.html)
      source = { __html: source.html };

    return {
      ...props,
      className: this.getClassName('raWebView', props.className),
      dangerouslySetInnerHTML: source
    };
  }

  componentDidUpdate() {
    super.componentDidUpdate.apply(this, arguments);

    if (this.rootElement) {
      // Run scripts (scripts are not run when injected via innerHTML)
      var scriptElements = Array.prototype.slice.apply(this.rootElement.getElementsByTagName('SCRIPT'));
      for (var i = 0; i < scriptElements.length; i++) {
        var scriptElement = scriptElements[i],
            textNode = document.createTextNode(scriptElement.innerHTML),
            parentNode = scriptElement.parentNode,
            newScript = document.createElement("script");

        parentNode.removeChild(scriptElement);
        newScript.appendChild(textNode);
        parentNode.appendChild(newScript);
      }
    }
  }
}
//###}###//

export {
  WebView
};
