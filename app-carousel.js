
/**
  * `app-carousel`
  * 
  *   This element takes slotted elements and controls how they scroll horizontally.
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
  *   Api:
  *
  *     Properties:
  *
  *       aspect-ratio <String> 'landscape', Width to height ratio.
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
  *     Methods:
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
  *     Events:
  *
  *       'app-carousel-centered-item-changed', {value: item} 
  *         Fired each time a new element becomes centered in the carousel.
  *
  *       'app-carousel-section-index-changed', {value: index}
  *         Fired each time the section index changes.
  *
  *       'app-carousel-sections-changed', {value: sections}
  *         Fired each time items in the carousel change, thus triggering new section items creation.
  *
  *
  *
  *
  * @customElement
  * @polymer
  * @demo demo/index.html
  *
  **/

import {
  AppElement, 
  html
} from '@longlost/app-element/app-element.js';

import {
  head, 
  tail, 
  toObj
} from '@longlost/lambda/lambda.js';

import {
  isDisplayed, 
  schedule, 
  wait
} from '@longlost/utils/utils.js';

import htmlString from './app-carousel.html';
import '@longlost/app-icons/app-icons.js';
import '@longlost/app-shared-styles/app-shared-styles.js';
import '@polymer/paper-icon-button/paper-icon-button.js';
import '@polymer/paper-ripple/paper-ripple.js';
import '@polymer/iron-icon/iron-icon.js';


const isOdd = num => num % 2 === 1;

// Center is element's x coordinate plus half its width.
const getCenter = bbox => bbox.x + (bbox.width / 2);


class AppCarousel extends AppElement {
  static get is() { return 'app-carousel'; }

  static get template() {
    return html([htmlString]);
  }


  static get properties() {
    return {

      // Sets the proportion of width to height.
      // 'classic', 'fill', 'landscape', 'portrait' or 'square'
      aspectRatio: {
        type: String,
        value: 'landscape'
      },

      // Set true to have carousel iterate 
      // through sections automatically.
      autoplay: Boolean,

      // Disable scrolling when true.
      disabled: Boolean,

      // Display navigation dots when true.
      dots: Boolean,

      // How many ms to wait between each flip.
      flipTime: {
        type: Number,
        value: 3000
      },

      // Set to true to have clickable navigation arrows.
      nav: Boolean,

      // Where to place items relative to scroll container.
      position: {
        type: String,
        value: 'center' // Or 'start' or 'end'.
      },

      // Cached #scrollContainer element if using the default slot,
      // or the custom scroller when using the 'scroller' slot.
      // Used to dynamically measure bbox for calculations.
      scrollContainer: Object,

      // Currently centered item. Not used internally.
      // Fired in 'app-carousel-centered-item-changed' event.
      _centeredItem: {
        type: Object,
        computed: '__computeCenteredItem(_intersectingItems, scrollContainer)'
      },

      // Debounce IntersectionObserver callback changes.
      _debouncedItems: Object,

      // Controls how many dots stamp out and 
      // which one gets the selected class.
      _dotsArray: {
        type: Array,
        computed: '__computeDotsArray(_sectionCount, _sectionIndex)'
      },

      // Used for a Safari workaround.
      // Safari resets the scroller's position after
      // a programmic scroll when scroll-snap is used.
      // See '__safariProgrammicScrollSnapFix' method.
      _expectedIndex: Number,

      // Cached, reused instance of IntersectionObserver.
      _intersectionObserver: Object,

      // IntersectionObserver options threshold prop.
      // Expected values are any float between 0 and 1.
      _intersectionThreshold: {
        type: Number,
        value: 0.99
      },

      // The items that are that are contained inside
      // parent at any given time according to 
      // IntersectionObserver Api.
      _intersectingItems: {
        type: Array,
        computed: '__computeIntersectingItems(_observedItems.*)'
      },

      // Current playing state.
      _isPlaying: Boolean,

      // The slotted elements contained in the carousel.
      _items: {
        type: Array,
        observer: '__itemsChanged'
      },

      // Number of slotted dom nodes.
      _itemCount: {
        type: Number,
        computed: '__computeItemCount(_items)'
      },

      // The maximum number of items that are contained inside
      // parent at any given time according to 
      // IntersectionObserver Api.
      // Is set to undefined each time slotted items changes
      // so we only set this in the __intersectingItemsChanged
      // method once per slotted items change.
      // Otherwise the calculations can become unreliable
      // when the user manually scrolls. 
      _maxIntersecting: Number,

      // Used by __resizeHandler method to reset carousel
      // after screen resizes.
      _oldSectionIndex: Number,

      // IntersectionObserver observed items.
      // Keyed by item index.
      _observedItems: Object,

      // Used for window 'resize' events.
      // An observer watches this index number
      // as well as the _sections prop to ensure
      // section dom is rendered before attempting
      // and animation.
      _resizeIndex: Number,

      // Section count is smaller than item count if 
      // displaying more multiple items at a time.
      _sectionCount: {
        type: Number,
        computed: '__computeSectionCount(_itemCount, _maxIntersecting, position)'
      },

      // Fired in 'app-carousel-section-index-changed' event.
      // Section items can differ from slotted items
      // since a section can contain multiple items.
      // Use this prop in conjunction with 'moveToSection'
      // and/or 'animateToSection' public api, to control
      // the carousel.
      _sectionIndex: {
        type: Number,
        computed: '__computeSectionIndex(_sections, _intersectingItems, position)',
        observer: '__sectionIndexChanged'
      },

      // Fired in 'app-carousel-sections-changed' event.
      // Section items can differ from slotted items
      // since a section can contain multiple items.
      // Use this prop in conjunction with 'moveToSection'
      // and/or 'animateToSection' public api, to control
      // the carousel.      
      _sections: {
        type: Array,
        computed: '__computeSections(_observedItems.*, _sectionCount, position)'
      },

      // Used by container on-up/on-down handlers.
      // If carousel was playing, stop anytime user
      // is interacting with carousel, then resume
      // playing once user is done.
      _shouldResume: Boolean

    };
  }


  static get observers() {
    return [
      '__autoplayChanged(autoplay)',
      '__centeredItemChanged(_centeredItem)',
      '__disabledChanged(disabled)',
      '__intersectingItemsChanged(_intersectingItems)',
      '__resizeIndexSectionsChanged(_resizeIndex, _sections)',
      '__sectionsChanged(_sections)'
    ];
  }


  constructor() {
    super();

    this.__setupIntersectionObserver();
  }


  connectedCallback() {
    super.connectedCallback();

    if (!this.scrollContainer) {

      // Used to dynamically measure bbox for calculations.
      this.scrollContainer = this.$.scrollContainer;
    }

    this.__resizeHandler = this.__resizeHandler.bind(this);

    // Correct for screen resizes.
    window.addEventListener('resize', this.__resizeHandler);

    // Scroll options polyfill for safari, supports {behavior: 'smooth'}
    // for all scroll functions (ie. window.scrollTo, element.scrollIntoVeiw).
    if (!('scrollBehavior' in document.documentElement.style)) {
      import(
        /* webpackChunkName: 'scroll-polyfill' */ 
        'scroll-behavior-polyfill'
      );
    }
  }


  disconnectedCallback() {
    super.disconnectedCallback();

    window.removeEventListener('resize', this.__resizeHandler);
  }

  // Array of all observed elements 
  // with a true isIntersecting prop.
  __computeIntersectingItems(polymerObj) {    
    if (
      !polymerObj ||
      !polymerObj.base
    ) { return; }

    const {base: observed} = polymerObj;

    // Ignore items that are ouside of scroller.

    // FireFox workaround!!
    // Cannot use item.isIntersecting with FireFox 70 as it
    // does not properly reflect the intersecting state with
    // regards to the intersection threshold.
    const intersecting = 
      Object.values(observed).filter(item => 
        item.intersectionRatio >= this._intersectionThreshold);

    return intersecting;
  }

  // Not used internally.  Only for consumer.
  // Fired in 'app-carousel-centered-item-changed' event.
  __computeCenteredItem(intersectingItems, container) {
    if (!intersectingItems || !container) { return; }

    // Dynamically measure scroll container to catch resizes.
    const containerBBox = container.getBoundingClientRect();

    // Use real measurements instead of relying on the item carouselIndex
    // for cases where items have been rearranged but not reordered.
    const distances = intersectingItems.map(item => {
      const {target} = item;

      // Cannot rely on bbox measurements that come with each
      // entry since an intersecting element can be intersecting
      // for some time since the last item became visible.
      // Must take fresh measurements and replace the existing data.
      const boundingClientRect = target.getBoundingClientRect();
      const containerCenter    = getCenter(containerBBox);
      const itemCenter         = getCenter(boundingClientRect); 
      const distance           = Math.abs(containerCenter - itemCenter);

      return {...item, boundingClientRect, distance}; 
    });

    // Find the fully intersecting item that is closest to center.
    const centered = distances.reduce((prev, curr) => {
      const {distance} = prev;

      if (typeof distance !== 'number') { // First iteration.
        return curr;
      }

      // Closest item to center of container.
      if (distance >= curr.distance) {
        return curr;
      }

      return prev;      
    }, {});

    return centered;
  }


  __computeItemCount(items) {    
    if (Array.isArray(items)) {
      return items.length;
    }

    return 0;
  }


  __computeSectionCount(itemCount, maxIntersecting, position) {
    if (
      itemCount       === undefined || 
      maxIntersecting === undefined ||
      !position
    ) { return 0; }

    if (position === 'start' || position === 'end') {
      const sectionDiff = maxIntersecting - 1;
      const count       = itemCount - sectionDiff;
      return count;
    }

    // Position center.
    // The number of sections is determined by the maximum
    // number of fully intersecting items, n.  
    // If n is odd, subtract n - 1 from total items count.  
    // If n is even, subtract n - 2 from total items count. 
    const odd         = isOdd(maxIntersecting);
    const sectionDiff = odd ? 
                          maxIntersecting - 1 : 
                          maxIntersecting - 2;

    const count = itemCount - sectionDiff;

    return count;
  }


  __computeSections(polymerObj, sectionCount, position) {

    // Noop if items is undefined or if 
    // sectionCount is undefined or less than 1.
    if (
      !polymerObj ||
      !polymerObj.base ||
      sectionCount === undefined || 
      sectionCount < 1 ||
      !position
    ) { return; }

    const {base: observed} = polymerObj;

    const items = Object.values(observed).sort((a, b) => 
                    a.carouselIndex - b.carouselIndex); 

    if (position === 'start') {

      // Remove the dfference between total items 
      // and sections from the end of items array.
      const endRemoved = items.slice(0, sectionCount);

      return endRemoved;
    }

    const count = items.length; 

    if (position === 'end') {

      // Remove the dfference between total items 
      // and sections from the beginning of items array.
      const startRemoved = items.slice(count - sectionCount);

      return startRemoved;
    }

    // The difference between items count and 
    // sectionCount should always be and even number.
    // So remove an even number of items from the beginning
    // and end of the items array to get the remaining items
    // which represent the section centers.
    const diff     = (count - sectionCount) / 2;
    const endIndex = count - diff;

    // Chop off end of items array first.
    const endRemoved = items.slice(0, endIndex);

    // Remove from start of new array.
    const startRemoved = endRemoved.slice(diff);

    return startRemoved;
  }


  __computeSectionIndex(sections, intersecting, position) {
    if (
      !sections || 
      !intersecting || 
      intersecting.length === 0 ||
      !position
    ) { return; }

    const sectionIndexFromIntersectingItem = item => {
      const {carouselIndex} = item;

      return sections.findIndex(section => 
               section.carouselIndex === carouselIndex); 
    };

    if (position === 'start') {

      // Always use first intersecting item with 'start'.
      const item = head(intersecting);

      return sectionIndexFromIntersectingItem(item);
    }

    if (position === 'end') {

      // Always use first intersecting item with 'end'.
      const item = tail(intersecting);

      return sectionIndexFromIntersectingItem(item);
    }

    // Position === 'center'.    
    const intersectingCount = intersecting.length;
    const intersectingIsOdd = isOdd(intersectingCount);

    // Take the middle item's carouselIndex to determine section.
    if (intersectingIsOdd) {
      const middleIndex = (intersecting.length - 1) / 2;
      const item        = intersecting[middleIndex];

      return sectionIndexFromIntersectingItem(item);
    }

    const firstIntersecting = head(intersecting);

    // First element is a special case.  
    // If it's fully visible then we must be
    // on the first section.
    if (firstIntersecting.carouselIndex === 0) {
      return 0;
    }

    // Since the carousel moves LTR, use the first
    // element to the right of dead center.
    const middleishIndex = intersecting.length / 2;
    const item = intersecting[middleishIndex];

    return sectionIndexFromIntersectingItem(item);
  }

  // Move selected class to currently visible dot.
  __computeDotsArray(count, index) {
    const array = [];

    for (let i = 0; i < count; i += 1) {
      const obj = {selected: ''};

      if (i === index) {
        obj.selected = 'selected';
      }
      array.push(obj);
    }

    return array;
  }


  __setupIntersectionObserver() {
    const options = {
      root:        this,
      rootMargin: '0px',
      threshold:   this._intersectionThreshold
    };

    const callback = entries => {

      entries.forEach(entry => {
        const {carouselIndex}  = entry.target;
        const prevData = this._observedItems[carouselIndex];
        const currData = toObj(entry);

        // Keep carouselIndex from '__itemsChanged'.
        this.set(
          `_observedItems.${carouselIndex}`, 
          {...prevData, ...currData}
        );
      });
    };

    this._intersectionObserver = 
      new window.IntersectionObserver(callback, options);
  }


  async __slotChangedHandler() {
    try {
      await this.debounce('app-carousel-slot-debounce', 200);  

      const nodes = this.slotNodes('#itemsSlot');
      this._items = nodes.filter(node => 
                      node.tagName !== undefined && 
                      node.tagName !== 'DOM-REPEAT');
    }
    catch (error) {
      if (error === 'debounced') { return; }
      console.error(error);
    }
  }


  __itemsChanged(items, oldItems) { 
    if (Array.isArray(oldItems)) {
      oldItems.forEach(item => {
        this._intersectionObserver.unobserve(item);
      });  
    }

    if (Array.isArray(items)) {

      // Hack!! See notes in properties definition above.
      this._maxIntersecting = undefined;

      // Create/clear cached vals. 
      this._observedItems = {}; 

      items.forEach((item, carouselIndex) => {

        // Build a dictionary of observed elements
        // so we can keep track of state.
        // We need this so we can dynamically compute
        // the currently centered item along with the
        // IntersectionObserver Api.
        item.carouselIndex = carouselIndex;

        // Not using Polymer's set api so we don't trigger
        // computed properties and other observers.
        this._observedItems[carouselIndex] = {carouselIndex};
        this._intersectionObserver.observe(item);
      });
    }
  }

  // Cannot use a computed here because we need
  // to latch this method to only set the
  // '_maxIntersecting' value once, so that it
  // remains stable.
  __intersectingItemsChanged(items) {

    // Hack!!  Only run once to maintain stability.
    // Otherwise this becomes unreliable when the user
    // maually scrolls.
    if (typeof this._maxIntersecting === 'number') { return; }

    if (!Array.isArray(items)) {
      this._maxIntersecting = undefined;
    }

    // Ignore circumstances where the carousel 
    // itself is not on screen (ie. no intersecting items).
    else if (items.length > 0) {
      this._maxIntersecting = items.length;
    }
  }


  __autoplayChanged(bool) {
    if (bool) {
      this.__play();
    }
  }


  __centeredItemChanged(item) {
    if (!item) { return; }

    this.fire('app-carousel-centered-item-changed', {value: item});
  }


  __disabledChanged(disabled) {
    if (disabled) {
      this.scrollContainer.style['pointer-events'] = 'none';
    }
    else {
      this.scrollContainer.style['pointer-events'] = 'auto';
    }
  } 

  // Reset the scroller back to the current item.
  __dynamicScrollerPositionCorrection(left) {

    // Chrome and FireFox will respect the first attempt to reset
    // the scroller's position, but Safari is very stubborn.
    // The number of attempts to reset its position varies greatly,
    // so take dynamic measurements and keep trying until it works.
    const correctScrollPosition = (tries, doubleChecked) => {

      // MUST be rAF and NOT `schedule` for Safari!
      window.requestAnimationFrame(() => {

        // Bail if the carousel is not visible or ready.
        if (!this.scrollContainer || !isDisplayed(this)) { return; } 

        // Give up trying if this consumes too much time and is not
        // working effectively. Safari is unpredictable.
        if (this.scrollContainer.scrollLeft === left || tries === 10) {

          // The scroller is where it should be.
          // Double check that it is, measure it one more time.
          if (!doubleChecked) {            
            correctScrollPosition(tries, true);
          }
        }
        else {

          // Attempt to move the scroller back to the correct position again.
          this.scrollContainer.scroll(left, 0);

          // Increment 'tries' and measure again.
          correctScrollPosition(tries + 1, false);
        }        
      });     
    };

    // This first try works on Chrome and Firefox, but not Safari.
    // For some strange reason, the first call to .scroll must
    // be different than the next for it to work correctly on Safari.
    // Without this, a single frame of the scroller being in the 
    // previous position is rendered before being corrected.
    this.scrollContainer.scroll(left - 1, 0);

    correctScrollPosition(1, false);
  }

  // Safari workaround.
  // Safari resets the scroller's position after
  // a programmic scroll when scroll-snap is used.
  __safariProgrammicScrollSnapFix(index) {
    
    if (index !== this._expectedIndex) { return; } // Not a programmic change.

    this._expectedIndex = undefined;

    // MUST use rAF here for Safari!
    window.requestAnimationFrame(() => {     
      const left = this.scrollContainer.scrollLeft;

      if (typeof left !== 'number') { return; }
      
      this.__dynamicScrollerPositionCorrection(left);
    });
  }


  __sectionIndexChanged(index, oldIndex) {

    // Cache old index for screen resizes.
    // Used by __resizeHandler method.
    this._oldSectionIndex = oldIndex;

    if (typeof index !== 'number') { return; }

    this.fire('app-carousel-section-index-changed', {value: index});    

    this.__safariProgrammicScrollSnapFix(index);
  }


  __sectionsChanged(sections) {
    if (!sections) { return; }

    this.fire('app-carousel-sections-changed', {value: sections});
  }


  __getLeftDeltaFromIndex(index) {

    if (!this._sections[index]) { return 0; }

    // Dynamically measure scroller and target elements
    // in order to catch all resizes.
    const {target}      = this._sections[index];
    const bbox          = target.getBoundingClientRect();
    const containerBBox = this.scrollContainer.getBoundingClientRect();

    const getDelta = () => {

      if (this.position === 'start') {
        const targetX    = bbox.x;
        const containerX = containerBBox.x;

        return targetX - containerX;
      }

      if (this.position === 'end') {
        const targetX    = bbox.x          + bbox.width;
        const containerX = containerBBox.x + containerBBox.width;

        return targetX - containerX;
      }

      if (this.position === 'center') {

        // Find centers since widths can vary.
        const targetCenter    = getCenter(bbox);
        const containerCenter = getCenter(containerBBox);

        // Use the distance between centers to pass in to scrollBy.
        return targetCenter - containerCenter;
      }

      throw new Error(`app-carousel position property must one of three choices - 
        'start'
        'center'
        'end'
      `);
    };

    return getDelta();
  }

  // This observer ensures that there are stamped
  // sections when a 'resize' event is fired.
  async __resizeIndexSectionsChanged(index, sections) {
    if (typeof index !== 'number' || !sections) { return; }

    this._resizeIndex = undefined;

    // Must have for Safari.
    await schedule();

    const delta = this.__getLeftDeltaFromIndex(index);
    const left  = this.scrollContainer.scrollLeft + delta;

    this.__interrupt();
    this.__dynamicScrollerPositionCorrection(left);
  }


  __play() {
    this._isPlaying = true;

    // Reset each time play is called.
    window.clearInterval(this._playTimerId); 

    this._playTimerId = window.setInterval(() => {
      this.nextItem('right', 'recycle');
    }, this.flipTime);
  }

  // Interrupt playing and reset timer if
  // carousel was previously playing.
  __interrupt() {
    if (this._isPlaying) {
      this.__play();
    }
  }


  __stop() {
    this._isPlaying = false;
    window.clearInterval(this._playTimerId);
  }

  // Stop playing anytime user is 
  // manually scrolling the carousel.
  __containerOnDown() {
    if (this._isPlaying) {
      this._shouldResume = true;
      this.__stop();
    }
  }

  // Resume playing when user is 
  // done manually scrolling carousel.
  __containerOnUp() {
    if (this._shouldResume) {
      this._shouldResume = false;
      this.__play();
    }
  }


  async __navArrowClicked(direction) {
    try {
      await this.clicked();

      this.nextItem(direction);
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

      const {index} = event.model;
      this.animateToSection(index);
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  __goToSection(index, behavior = 'smooth') {    

    // Safari polyfill bug!   
    // Cannot use scrollIntoView with 
    // 'scroll-behavior-polyfill' as of version 2.0.13,
    // because ther is a bug with the polyfill correctly 
    // finding slotted elements' scroller parent.
    // target.scrollIntoView({ // does not work in safari
    //   behavior,
    //   block:  'nearest',
    //   inline: 'center'
    // });

    // Safari fix.
    // Safari resets the scroller's position after
    // a programmic scroll when scroll-snap is used.
    // See '__safariProgrammicScrollSnapFix' method.
    this._expectedIndex = index;

    this.__interrupt();

    const left = this.__getLeftDeltaFromIndex(index);

    this.scrollContainer.scrollBy({
      top: 0,
      left,
      behavior
    });
  }

  // Sometimes the resize puts items in a state where none are
  // intersecting, so reset carousel to last known good index.
  __resizeHandler() {
    if (typeof this._sectionIndex === 'number') {
      this._resizeIndex = this._sectionIndex;
    }
    else if (typeof this._oldSectionIndex === 'number') {
      this._resizeIndex = this._oldSectionIndex;
    }
  }


  async __showAvIcon(type) {
    const icon = type === 'play' ? this.$.playIcon : this.$.stopIcon;

    icon.classList.add('show-av-icon');

    await wait(400);

    icon.classList.remove('show-av-icon');
  }


  animateToSection(index) {
    this.__goToSection(index);
  }


  moveToSection(index) {
    this.__goToSection(index, 'auto');
  }


  nextItem(direction = 'right', recycle = '') {

    // When user is scrolling/dragging items.
    if (typeof this._sectionIndex !== 'number') {
      return;
    }

    if (direction === 'right') {

      // Go back to first section if at last section.
      if (this._sectionIndex + 1 >= this._sectionCount) {

        if (recycle === 'recycle') {
          this.animateToSection(0);
          return;
        }
      } 
      else { // Next section.
        const index = this._sectionIndex + 1;
        this.animateToSection(index);
        return;
      }
    } 
    else if (direction === 'left') {

      // Go back to last section if at first section.
      if (this._sectionIndex - 1 < 0) {

        if (recycle === 'recycle') {
          this.animateToSection(this._sectionCount - 1);
          return;
        }
      } 
      else { // Next section.
        const index = this._sectionIndex - 1;
        this.animateToSection(index);
      }
    }
  }


  play() {
    this.__showAvIcon('play');
    this.__play();
  }


  stop() {
    this.__showAvIcon('stop');
    this.__stop();
  }

  // Temporary workaround for Safari.
  // Addresses a bug in Safari that arises from
  // a combination of dynamically adding/removing
  // slotted nodes with scroll-snap set.
  // Items here are the same as elements that are
  // slotted into the default slot.
  setItems(nodes) {
    this._items = nodes;
  }

}

window.customElements.define(AppCarousel.is, AppCarousel);
