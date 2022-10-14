
/**
  * `lite-carousel`
  * 
  *   A horizontally scrolled ui element used to display a list of 
  *   uniformly sized elements in a highly performant manner.
  *
  *
  *   NOTE:
  *
  *     When deciding which carousel element to use, consider the stengths and 
  *     weaknesses of the two carousels.
  *
  *     Compared to `app-carousel`, this element is best used for situations where:
  *
  *       - the number of items is relatively large
  *
  *       - pagination is required
  * 
  *       - an infinite scrolling carousel is required.
  *
  *       - child elements are sized identically
  *
  *
  *     Because of the way in which `lite-carousel` currently works around browser
  *     scroll snap re-snapping, it introduces a skipped frame anytime it is scrolled
  *     beyond the point of its internal scroll-snap target elements. This is due to
  *     it adding new snap target elements on the fly, as needed, which triggers a 
  *     re-snap calculation to be made by the browser.
  *
  *     Keep this in mind, along with the fact that child elements MUST be the same 
  *     size when choosing to use `lite-carousel`.
  *
  *   
  *   Styling:
  *
  *
  *   --carousel-dot-size:    default 8px
  *   --carousel-dot-spacing: default 8px
  *
  *   --carousel-item-width:  default 100%;
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
  *                                                          Dev must set height on <lite-carousel>.  
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
  *       infinite     <Boolean> undefined,  Set true to give the carousel an infinite scroll effect.
  *
  *       items        <Array> undefined,    Input collection of data used to create 
  *                                          displayed repeated DOM elements.
  *
  *       margin       <Number> 7,           This tunable scalar determines how many recycled containers
  *                                          are created, along with the calculated rootMargin used when
  *                                          implementing an IntersectionObserver. 
  *                                          See property notes for more details.
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
  *       'lite-carousel-centered-changed', {value: entry}
  *
  *         Fired each time a new element becomes centered in the carousel.
  *
  *
  *
  *       'lite-carousel-current-items-changed', {value: items}
  *
  *         Fired when the underlying 'lite-list' currently stamped items changes.
  *         Detail value is an array which is a subset of the provided 'items' array. 
  *         This array MUST drive the external template repeater, to keep items 
  *         synchronized with their recycled containers.
  *
  *
  *
  *       'lite-carousel-pagination-changed', {value: {count, end, start}} 
  *
  *         Fired anytime the underlying 'lite-list' requests more items
  *         to be added to the input 'items' array.
  *         Detail value is an object that contains 'count' 
  *         (number of recycled containers), 'start' and 'end' indexes.
  *         'start' represents the current topmost/leftmost visible item.
  *         'count' and 'end' are only hints to the developer and 
  *         are not strict boundaries or limits.
  *
  *
  *
  *       'lite-carousel-section-index-changed', {value: index}
  *
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
  

import {AppElement}              from '@longlost/app-core/app-element.js';
import {CarouselMixin}           from './carousel-mixin.js';
import {hijackEvent, listenOnce} from '@longlost/app-core/utils.js';
import template                  from './lite-carousel.html';
import '@longlost/app-core/app-shared-styles.css';
import '@longlost/app-lists/lite-list.js';
import './carousel-shared-styles.css';
import './carousel-controls.js';


class LiteCarousel extends CarouselMixin(AppElement) {

  static get is() { return 'lite-carousel'; }

  static get template() {
    return template;
  }


  static get properties() {
    return {

      // Will start back at beginning of 'items' when scrolled past the last
      // item in the list when 'infinite' is set.
      infinite: Boolean,

      // The collection used to 'hydrate' each repeated element.
      //
      // Indirectly drives repeater.
      //
      // Only a subset of the items is used at a time, 
      // dependent on scroll position.
      items: Array,

      // The width of `lite-list` is multiplied by
      // this number when stamping reusable containers. 
      //
      // The new value is used to calculate how many 
      // reusable items will be created, based off how many
      // containers will fit inside an virtual container of this size.
      //
      // A larger number will result in more offscreen containers,
      // so there is a tradeoff between scrolling performance and
      // memory/computational load.
      //
      // When tuning rendering performance, this number should scale 
      // in proportion to the width of individual repeated containers.
      //
      // Increase this number for wider containers that take up a 
      // large portion of the viewport.
      //
      // This number is clamped at a minimum of 1.5.
      margin: {
        type: Number,
        value: 7
      },

      _carouselName: {
        type: String,
        value: 'lite',
        readOnly: true
      },

      // Section count is smaller than item count if 
      // multiple items are visible at a time.
      _initialSectionCount: {
        type: Number,
        computed: '__computeSectionCount(items.length, _maxIntersecting, position)'
      },

      // Drives slotted template repeater for `lite-list`.
      _slotItems: Array,

      // Browser scroll-snap re-snapping workaround items.
      _snapItems: {
        type: Array,
        value: () => ([])
      },

      _sampleHeight: Number,

      _sampleWidth: Number

    };
  }


  static get observers() {
    return [
      '__sampleWidthHeightChanged(_sampleWidth, _sampleHeight)'
    ];
  }


  // Forward a renamed event for public api.
  __recycledListCurrentItemsHandler(event) {

    hijackEvent(event);

    const {value: items} = event.detail;    

    // Sync the number of available repeated slots with
    // that of `lite-list`.
    if (this._slotItems?.length !== items.length) {
      this._slotItems = items.map(item => undefined);
    }

    this.fire(`${this._carouselName}-carousel-current-items-changed`, event.detail);
  }

  // NOTE:
  //      This method is part of the browser scroll-snap
  //      re-snapping workaround.
  __addSnapItems(end) {

    const diff  = end - this._snapItems.length;

    if (diff < 1) { return; }

    this.push('_snapItems', ...Array(diff).fill(undefined));
  }


  __recycledListPaginationHandler(event) {

    hijackEvent(event);

    this.__addSnapItems(event.detail.value.end);

    this.fire(`${this._carouselName}-carousel-pagination-changed`, event.detail);
  }

  // NOTE:
  //      This method is part of the browser scroll-snap
  //      re-snapping workaround.
  //
  //      Must ensure that snap-scroll target elements are EXACTLY
  //      the same size as 'lite-list' containers, otherwise
  //      the snap points will become offset from the slotted children.
  __recycledListSampleBboxHandler(event) {

    hijackEvent(event);

    const {height, width} = event.detail.value;

    this._sampleHeight = height;
    this._sampleWidth  = width;
  }


  async __domChangeHandler() {

    try {  

      await this.debounce('carousel-dom-change-debounce', 200);

      // Initial batch of observed elements.
      if (!this._elements) {
        this._elements = this.selectAll('.snap-item');
      }

      // Add new items to observer as they are created, versus 
      // iterating over the entire, growing set of elements.
      else {
        const newElements = this.selectAll('.snap-item:not(.observed)');

        if (!newElements.length) { return; }

        // Issue new carouselIndex values starting 
        // at the previous number of elements
        this.__observeNewElements(newElements, this._intersectionObserver, this._elements.length);

        this.push('_elements', ...newElements);
      }
    }
    catch (error) {
      if (error === 'debounced') { return; }
      console.error(error);
    }
  }


  __sampleWidthHeightChanged(width, height) {

    if (!width || !height) { return; }

    const hostBbox = this.getBoundingClientRect();

    // Must adjust the threshold if the child is wider than the host el.
    if (width > hostBbox.width) {
      this._intersectionThreshold = (hostBbox.width / width) - 0.01;
    }
    else {
      this._intersectionThreshold = 0.99;
    }

    this.updateStyles({
      '--snap-item-height': `${height}px`,
      '--snap-item-width':  `${width}px`
    });
  }


  __sectionIndexChanged(index, oldIndex) {

    // Cache old index for screen resizes.
    // Used by __resizeHandler method.
    this._oldSectionIndex = oldIndex;

    if (typeof index !== 'number') { return; }

    this.fire(`${this._carouselName}-carousel-section-index-changed`, {value: index}); 
  }


  __dotSelectedHandler(event) {

    hijackEvent(event);

    const {selected} = event.detail;

    // This represents how many times the user has cycled through
    // an 'infinite' list of carousel elements.
    const iterations = Math.floor(this._sectionIndex / this._initialSectionCount);

    if (iterations === 0) {        
      this.animateToSection(selected);        
      return;
    }

    // Move to the closest iteration of a given dot index.
    // Favor moving back an iteration if it is closer, 
    // so that less 'snap-items' are created.
    const currentBase  = this._initialSectionCount * iterations;
    const previousBase = this._initialSectionCount * (iterations - 1);

    // The new set of possible indexes.
    const a = selected + currentBase;
    const b = selected + previousBase;

    // The distances between the current index 
    // and the new possible indexes.
    const deltaA = Math.abs(this._sectionIndex - a);
    const deltaB = Math.abs(this._sectionIndex - b);

    // Go back to a previous iteration's index 
    // if it's closer than going forward.
    // Otherwise, stay on the same iteration cycle.
    const closestIndex = deltaA <= deltaB ? a : b;

    this.animateToSection(closestIndex);
  }


  async __goToSection(index, behavior = 'smooth') { 

    this.__interrupt();

    // Wait until new snap items are added before attempting to move.
    const diff  = (index - 1) - (this._snapItems.length - this._slotItems.length);

    if (diff > 0) {
      this.push('_snapItems', ...Array(diff).fill(undefined));

      await listenOnce(this.$.snapRepeater, 'dom-change');
    }

    const {target} = this._sections[index];

    target.scrollIntoView({
      behavior,
      block:  'nearest',
      inline: this.position
    });
  }

}

window.customElements.define(LiteCarousel.is, LiteCarousel);
