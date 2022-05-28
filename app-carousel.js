
/**
  * `app-carousel`
  * 
  *   This element takes slotted elements and controls how they scroll horizontally.
  *
  *
  *   NOTE:
  *
  *     When deciding which carousel element to use, consider the stengths and 
  *     weaknesses of the two carousels.
  *
  *     Compared to `recycled-carousel`, this element is best used for situations where:
  *
  *       - the number of items is relatively small
  *
  *       - the number of items is fixed (no pagination)
  *
  *       - child elements may differ in size
  *
  *
  *     Because of the way in which `recycled-carousel` currently works around browser
  *     scroll snap re-snapping, it introduces a skipped frame anytime it is scrolled
  *     beyond the point of its internal scroll-snap target elements. This is due to
  *     it adding new snap target elements on the fly, as needed, which triggers a 
  *     re-snap calculation to be made by the browser.
  *
  *     Keep this in mind, along with the fact that child elements MUST be the same 
  *     size when choosing NOT to use `recycled-carousel`.
  *
  *
  *
  *   
  *   Styling:
  *
  *   --carousel-dot-size:    default 8px
  *   --carousel-dot-spacing: default 8px
  * 
  *   --carousel-ui-color, 
  *   --carousel-ui-background-color,
  *   --carousel-ui-ink-color: nav btns, av btns and dots
  *
  *   
  *
  *   Api:
  *
  *
  *     Properties:
  *
  *
  *       aspect       <String> 'landscape', Width to height ratio.
  *                                          'classic'   --> 4:3
  *                                          'fill'      --> Same width and height of parent.
  *                                                          Dev must set height on <app-carousel>.  
  *                                          'landscape' --> 16:9
  *                                          'portrait'  --> 9:16
  *                                          'square'    --> Height equal to width.
  *
  *       autoplay     <Boolean> false,      Starts player immediately.
  *
  *       dots         <Boolean> false,      Section index ui dots.
  *
  *       flip-time    <Number>  3000,       Milliseconds to wait between each flip.
  *
  *       nav          <Boolean> false,      Include nav ui.
  *
  *       position     <String> 'center',    How carousel positions elements relative to self.
  *
  *
  *
  *
  *     Methods:
  *
  *     
  *       animateToSection(index)       Animate to a given section by index number.
  *
  *       moveToSection(index)          Instant move to a given section by index number.
  *
  *       nextItem(direction, recycle)  Animate to next slide, pass in direction and if it should
  *                                       wrap from last slide to begining slide.
  *
  *       play()                        Start carousel flips.
  *
  *       stop()                        Stop carousel flips.
  *
  *
  *
  *
  *     Events:
  *
  *
  *       'app-carousel-centered-changed', {value: entry} 
  *         Fired each time a new element becomes centered in the carousel.
  *
  *
  *       'app-carousel-section-index-changed', {value: index}
  *         Fired each time the section index changes.
  *
  *
  *
  *
  * @customElement
  * @polymer
  * @demo demo/index.html
  *
  **/
  

import {AppElement}    from '@longlost/app-core/app-element.js';
import {CarouselMixin} from './carousel-mixin.js';
import {hijackEvent}   from '@longlost/app-core/utils.js';
import template        from './app-carousel.html';
import '@longlost/app-core/app-shared-styles.css';
import './carousel-shared-styles.css';
import './carousel-controls.js';


class AppCarousel extends CarouselMixin(AppElement) {

  static get is() { return 'app-carousel'; }

  static get template() {
    return template;
  }


  static get properties() {
    return {

      _carouselName: {
        type: String,
        value: 'app',
        readOnly: true
      },

      // IntersectionObserver options threshold prop.
      // Expected values are any float between 0 and 1.
      _intersectionThreshold: {
        type: Number,
        value: 0.99
      }

    };
  }


  async __slotChangedHandler() {

    try {
      await this.debounce('app-carousel-slot-debounce', 200);  

      const nodes = this.slotNodes('#itemsSlot');

      this._elements = nodes.filter(node => 
                         node.tagName !== undefined && 
                         node.tagName !== 'DOM-REPEAT');
    }
    catch (error) {
      if (error === 'debounced') { return; }
      console.error(error);
    }
  }


  __sectionIndexChanged(index, oldIndex) {

    // Cache old index for screen resizes.
    // Used by __resizeHandler method.
    this._oldSectionIndex = oldIndex;

    if (typeof index !== 'number') { return; }

    this.fire('app-carousel-section-index-changed', {value: index}); 
  }


  __dotSelectedHandler(event) {

    hijackEvent(event);

    this.animateToSection(event.detail.selected);
  }


  __goToSection(index, behavior = 'smooth') { 

    this.__interrupt();

    const {target} = this._sections[index];

    target.scrollIntoView({
      behavior,
      block:  'nearest',
      inline: this.position
    });
  }

  // Temporary workaround for Safari.
  // Addresses a bug in Safari that arises from
  // a combination of dynamically adding/removing
  // slotted nodes with scroll-snap set.
  // Items here are the same as elements that are
  // slotted into the default slot.
  setElements(nodes) {

    this._elements = nodes;
  }

}

window.customElements.define(AppCarousel.is, AppCarousel);
