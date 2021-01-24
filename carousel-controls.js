
/**
  * `carousel-controls`
  * 
  *   Optional navigation arrow buttons and selectable carousel section dots.
  *
  *
  *
  *   
  *   Styling:
  *
  *
  *   --carousel-dot-size:    default 8px
  *   --carousel-dot-spacing: default 8px
  * 
  *   --carousel-ui-color, 
  *   --carousel-ui-background-color,
  *   --carousel-ui-ink-color: nav btns, av icons and dots
  *   
  *
  *
  *   Api:
  *
  *
  *     Properties:
  *
  *
  *       dots <Boolean> default - undefined, Set to true to display section index ui dots.
  *
  *       nav  <Boolean> default - undefined, Set to true to include nav ui buttons.
  *
  *
  *
  *
  *     Methods:
  *     
  *
  *       play() Briefly show a centered 'play' icon.
  *
  *       stop() Briefly show a centered 'stop' icon.
  *
  *
  *
  *     
  *     Events:
  *
  *
  *       'carousel-controls-nav-clicked', {direction}
  *
  *         Fired when a nav arrow button is clicked. 
  *         Detail payload has a 'direction' string value 
  *         which represents the 'left' or 'right' button.
  *
  *
  *       'carousel-controls-dot-selected', {selected: index}
  *
  *         Fired when a dot is clicked.
  *         Detail payload includes the index of the 'selected' dot.
  *
  *       
  *
  *
  * @customElement
  * @polymer
  * @demo demo/index.html
  *
  **/

import {AppElement, html} from '@longlost/app-core/app-element.js';
import {wait}             from '@longlost/app-core/utils.js';
import htmlString         from './carousel-controls.html';
import '@longlost/app-core/app-icons.js';
import '@polymer/paper-icon-button/paper-icon-button.js';
import '@polymer/paper-ripple/paper-ripple.js';
import '@polymer/iron-icon/iron-icon.js';
import './carousel-icons.js';


class CarouselControls extends AppElement {
  
  static get is() { return 'carousel-controls'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {

      // The total number of dots to display.
      count: Number,

      // Display navigation dots when true.
      dots: Boolean,

      // The index of the currently selected dot.
      index: Number,

      // Set to true to have clickable navigation arrows.
      nav: Boolean,

      // Controls how many dots stamp out and 
      // which one gets the selected class.
      _dotItems: {
        type: Array,
        computed: '__computeDotItems(count, index)'
      }

    };
  }

  // Move selected class to currently visible dot.
  __computeDotItems(count, index) {

    const selectedIndex = typeof index === 'number' ? index % count : undefined;

    const array = [];

    for (let i = 0; i < count; i += 1) {

      const selected = i === selectedIndex ? 'selected' : '';      

      array.push({selected});
    }

    return array;
  }


  async __navArrowClicked(direction) {

    try {
      await this.clicked();

      this.fire('carousel-controls-nav-clicked', {direction});
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error); 
    }
  }


  __leftNavArrowClicked() {

    this.__navArrowClicked('left');
  }


  __rightNavArrowClicked() {  

    this.__navArrowClicked('right');
  }


  async __dotClicked(event) {

    try {
      await this.clicked();

      this.fire('carousel-controls-dot-selected', {
        selected: event.model.index
      });
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  async __showAvIcon(type) {

    const icon = type === 'play' ? this.$.playIcon : this.$.stopIcon;

    icon.classList.add('show-av-icon');

    await wait(400);

    icon.classList.remove('show-av-icon');
  }


  play() {

    this.__showAvIcon('play');
  }


  stop() {

    this.__showAvIcon('stop');
  }

}

window.customElements.define(CarouselControls.is, CarouselControls);
