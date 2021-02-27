
/**
  * `CarouselMixin`
  * 
  *   Logic which is common amongst carousel custom elements.
  *
  *
  *
  *  Properites:
  *
  *
  *    
  *
  *
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
  head, 
  tail
} from '@longlost/app-core/lambda.js';

import {
  hijackEvent,
  isDisplayed,
  schedule
} from '@longlost/app-core/utils.js';


const isOdd = num => num % 2 === 1;

// Center is element's x coordinate plus half its width.
const getCenter = bbox => bbox.x + (bbox.width / 2);


export const CarouselMixin = superClass => {

  return class CarouselMixin extends superClass {    


    static get properties() {
      return {

        // Sets the proportion of width to height.
        // 'classic', 'fill', 'landscape', 'portrait' or 'square'
        aspect: {
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
        // Fired in 'carousel-centered-changed' event.
        _centeredEntry: {
          type: Object,
          computed: '__computeCenteredEntry(_intersectingEntries, scrollContainer)'
        },

        // The scroll snap target elements contained in the carousel.
        _elements: {
          type: Array,
          observer: '__elementsChanged'
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
        _intersectionThreshold: Number,

        // The items that are that are contained inside
        // parent at any given time according to 
        // IntersectionObserver Api.
        _intersectingEntries: {
          type: Array,
          computed: '__computeIntersectingEntries(_entries.*, _intersectionThreshold)'
        },

        // Current playing state.
        _isPlaying: Boolean,

        // The maximum number of items that are contained inside
        // parent at any given time according to 
        // IntersectionObserver Api.
        // Is set to undefined each time slotted items changes
        // so we only set this in the '__intersectingEntriesChanged'
        // method once per slotted items change.
        // Otherwise, the calculations can become unreliable
        // when the user manually scrolls. 
        _maxIntersecting: Number,

        // Used by __resizeHandler method to reset carousel
        // after screen resizes.
        _oldSectionIndex: Number,

        // IntersectionObserver observed items.
        // Keyed by item index.
        _entries: Object,

        // Used for window 'resize' events.
        // An observer watches this index number
        // as well as the _sections prop to ensure
        // section dom is rendered before attempting
        // and animation.
        _resizeIndex: Number,

        // ResizeObserver instance.
        _resizeObserver: Object,

        // Section count is smaller than item count if 
        // displaying more multiple items at a time.
        _sectionCount: {
          type: Number,
          computed: '__computeSectionCount(_elements.length, _maxIntersecting, position)'
        },

        // Fired in 'recycled-carousel-section-index-changed' event.
        // Section items can differ from slotted items
        // since a section can contain multiple items.
        // Use this prop in conjunction with 'moveToSection'
        // and/or 'animateToSection' public api, to control
        // the carousel.
        _sectionIndex: {
          type: Number,
          computed: '__computeSectionIndex(_sections, _intersectingEntries, position)',
          observer: '__sectionIndexChanged'
        },

        // Section items can differ from slotted items
        // since a section can contain multiple items.
        // Use this prop in conjunction with 'moveToSection'
        // and/or 'animateToSection' public api, to control
        // the carousel.      
        _sections: {
          type: Array,
          computed: '__computeSections(_entries.*, _sectionCount, position)'
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
        '__centeredEntryChanged(_centeredEntry)',
        '__disabledChanged(disabled, scrollContainer)',
        '__elementsIntersectionObserverChanged(_elements, _intersectionObserver)',
        '__intersectingEntriesChanged(_intersectingEntries)',
        '__intersectionThresholdChanged(_intersectionThreshold)',
        '__resizeIndexSectionsChanged(_resizeIndex, _sections)'
      ];
    }


    connectedCallback() {

      super.connectedCallback();

      if (!this.scrollContainer) {

        // Used to dynamically measure bbox for calculations.
        this.scrollContainer = this.$.scrollContainer;
      }

      this.__resizeHandler = this.__resizeHandler.bind(this);
      this._resizeObserver = new window.ResizeObserver(this.__resizeHandler);

      this._resizeObserver.observe(this);

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

      this._resizeObserver?.disconnect();
      this._resizeObserver = undefined;

      this.__cleanupIntersectionObserver(this._elements);
    }

    // Not used internally. Only for consumer.
    // Fired in 'carousel-centered-changed' event.
    __computeCenteredEntry(intersecting, container) {

      if (!intersecting || !container) { return; }

      // Dynamically measure scroll container to catch resizes.
      const containerBBox = container.getBoundingClientRect();

      // Use real measurements instead of relying on the entry carouselIndex
      // for cases where elements have been rearranged but not reordered.
      const distances = intersecting.map(entry => {
        const {target} = entry;

        // Cannot rely on bbox measurements that come with each
        // entry since an intersecting entry can be intersecting
        // for some time since the last entry became visible.
        // Must take fresh measurements and replace the existing data.
        const boundingClientRect = target.getBoundingClientRect();
        const containerCenter    = getCenter(containerBBox);
        const elementCenter      = getCenter(boundingClientRect); 
        const distance           = Math.abs(containerCenter - elementCenter);

        return {...entry, boundingClientRect, distance}; 
      });

      // Find the fully intersecting element that is closest to center.
      const centered = distances.reduce((prev, curr) => {
        const {distance} = prev;

        if (typeof distance !== 'number') { // First iteration.
          return curr;
        }

        // Closest element to center of container.
        if (distance >= curr.distance) {
          return curr;
        }

        return prev;      
      }, {});

      return centered;
    }

    // Array of entries for all observed elements 
    // with a true isIntersecting prop.
    __computeIntersectingEntries(polymerObj, threshold) {    

      if (!polymerObj?.base || typeof threshold !== 'number') { return; }

      const {base: observed} = polymerObj;

      // Ignore elements that are ouside of scroller.

      // FireFox workaround!!
      // Cannot use item.isIntersecting with FireFox 70 as it
      // does not properly reflect the intersecting state with
      // regards to the intersection threshold.
      const intersecting = Object.
                             values(observed).
                             filter(item => 
                               item.intersectionRatio >= threshold);

      return intersecting;
    }


    __computeSections(polymerObj, sectionCount, position) {

      // Noop if entries is undefined or if 
      // sectionCount is undefined or less than 1.
      if (
        !polymerObj                ||
        !polymerObj.base           ||
        sectionCount === undefined || 
        sectionCount < 1           ||
        !position
      ) { return; }

      const {base: observed} = polymerObj;

      const entries = Object.values(observed).sort((a, b) => 
                        a.carouselIndex - b.carouselIndex); 

      if (position === 'start') {

        // Remove the dfference between total entries 
        // and sections from the end of entries array.
        const endRemoved = entries.slice(0, sectionCount);

        return endRemoved;
      }

      const count = entries.length; 

      if (position === 'end') {

        // Remove the dfference between total entries 
        // and sections from the beginning of entries array.
        const startRemoved = entries.slice(count - sectionCount);

        return startRemoved;
      }

      // The difference between entries count and 
      // sectionCount should always be and even number.
      // So remove an even number of entries from the beginning
      // and end of the entries array to get the remaining entries
      // which represent the section centers.
      const diff     = (count - sectionCount) / 2;
      const endIndex = count - diff;

      // Chop off end of entries array first.
      const endRemoved = entries.slice(0, endIndex);

      // Remove from start of new array.
      const startRemoved = endRemoved.slice(diff);

      return startRemoved;
    }


    __computeSectionCount(elementCount, maxIntersecting, position) {

      if (
        elementCount    === undefined || 
        maxIntersecting === undefined ||
        !position
      ) { return 0; }

      if (position === 'start' || position === 'end') {
        const sectionDiff = maxIntersecting - 1;
        const count       = elementCount - sectionDiff;

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

      const count = elementCount - sectionDiff;

      return count;
    }


    __computeSectionIndex(sections, intersecting, position) {

      if (
        !sections                 || 
        !intersecting             || 
        intersecting.length === 0 ||
        !position
      ) { return; }

      const sectionIndexFromIntersecting = entry => {
        const {carouselIndex} = entry;

        return sections.findIndex(section => 
                 section.carouselIndex === carouselIndex); 
      };

      if (position === 'start') {

        // Always use first intersecting entry with 'start'.
        const entry = head(intersecting);

        return sectionIndexFromIntersecting(entry);
      }

      if (position === 'end') {

        // Always use first intersecting entry with 'end'.
        const entry = tail(intersecting);

        return sectionIndexFromIntersecting(entry);
      }

      // Position === 'center'.    
      const intersectingCount = intersecting.length;
      const intersectingIsOdd = isOdd(intersectingCount);

      // Take the middle entry's carouselIndex to determine section.
      if (intersectingIsOdd) {
        const middleIndex = (intersecting.length - 1) / 2;
        const entry       = intersecting[middleIndex];

        return sectionIndexFromIntersecting(entry);
      }

      const firstIntersecting = head(intersecting);

      // First entry is a special case.  
      // If it's fully visible then we must be
      // on the first section.
      if (firstIntersecting.carouselIndex === 0) {
        return 0;
      }

      // Since the carousel moves LTR, use the first
      // entry to the right of dead center.
      const middleishIndex = intersecting.length / 2;
      const entry          = intersecting[middleishIndex];

      return sectionIndexFromIntersecting(entry);
    }


    __intersectionThresholdChanged(threshold) {

      if (typeof threshold === 'number') {
        this.__setupIntersectionObserver();
      }
    }


    __setupIntersectionObserver() {

      const options = {
        root:        this,
        rootMargin: '0px',
        threshold:   this._intersectionThreshold
      };

      // Reduce the memory footprint since '_entries'
      // grows as the user scrolls.
      const stripUnnecessaryFields = entry => ({
        intersectionRatio: entry.intersectionRatio,
        target:            entry.target
      });

      const callback = entries => {

        entries.forEach(entry => {
          const {carouselIndex} = entry.target;
          const prevData        = this._entries[carouselIndex];
          const currData        = stripUnnecessaryFields(entry);

          // Keep carouselIndex from '__elementsChanged'.
          this.set(
            `_entries.${carouselIndex}`, 
            {...prevData, ...currData}
          );
        });
      };

      this._intersectionObserver = 
        new window.IntersectionObserver(callback, options);
    }


    __elementsChanged(_, oldElements) {

      if (!oldElements || !this._intersectionObserver) { return; }

      this.__unobserve(oldElements);
    }


    __elementsIntersectionObserverChanged(elements, observer) {

      if (!Array.isArray(elements) || !observer) { return; }

      // Run once, when the first batch of snap-item elements
      // is stamped. Elements that are added after this are
      // added to the observer and cache as they are created.
      if (this._carouselName === 'recycled' && this._entries) { return; }

      // Hack!! See notes in properties definition above.
      this._maxIntersecting = undefined;

      // Initialize cache. 
      this._entries = {}; 

      this.__observeNewElements(elements, observer);
    }


    __observeNewElements(elements, observer, startingIndex = 0) {    

      elements.forEach((element, index) => {

        const carouselIndex = index + startingIndex;

        // Build a dictionary of observed elements
        // so we can keep track of state.
        // We need this so we can dynamically compute
        // the currently centered element along with the
        // IntersectionObserver Api.
        element.carouselIndex = carouselIndex;
        element.classList.add('observed');

        // Not using Polymer's set api so we don't trigger
        // computed properties and other observers.
        this._entries[carouselIndex] = {carouselIndex};

        observer.observe(element);
      });
    }

    // Cannot use a computed here because we need
    // to latch this method to only set the
    // '_maxIntersecting' value once, so that it
    // remains stable.
    __intersectingEntriesChanged(entries) {

      // Hack!!  Only run once to maintain stability.
      // Otherwise this becomes unreliable when the user
      // maually scrolls.
      if (typeof this._maxIntersecting === 'number') { return; }

      if (!Array.isArray(entries)) {
        this._maxIntersecting = undefined;
      }

      // Ignore circumstances where the carousel itself 
      // is not on screen (ie. no intersecting entries).
      else if (entries.length > 0) {
        this._maxIntersecting = entries.length;
      }
    }


    __autoplayChanged(bool) {

      if (bool) {
        this.__play();
      }
    }


    __centeredEntryChanged(entry) {

      if (!entry) { return; }

      this.fire(`${this._carouselName}-carousel-centered-changed`, {value: entry});
    }


    __disabledChanged(disabled, scrollContainer) {

      if (!scrollContainer) { return; }

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

        throw new Error(`${this._carouselName}-carousel position property must one of three choices - 
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

    // Wheel events do not have an end equivalent to mouse and touch events,
    // so debounce them and restart playing after the debounce wait time clears.
    async __containerOnWheel() {

      try {

        this.__containerOnDown();

        await this.debounce('carousel-wheel-event-debounce', 500);

        this.__containerOnUp();
      }
      catch (error) {
        if (error === 'debounced') { return; }

        console.error(error);
      }
    }


    __navClickedHandler(event) {

      hijackEvent(event);

      this.nextItem(event.detail.direction);
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


    __unobserve(elements) {

      if (!elements || !this._intersectionObserver) { return; }

      elements.forEach(element => {
        this._intersectionObserver.unobserve(element);
      }); 
    }


    __cleanupIntersectionObserver(elements) {

      if (!this._intersectionObserver) { return; }

      this.__unobserve(elements);

      this._intersectionObserver = undefined;
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

      this.$.controls.play();
      this.__play();
    }


    stop() {

      this.$.controls.stop();
      this.__stop();
    }

  };
};
