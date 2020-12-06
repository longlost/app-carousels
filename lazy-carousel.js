
/**
  *
  * `lazy-carousel`
  *
  *   Self lazy-loading images carousel.
  * 
  *
  *   
  *   Styling:
  *
  *   --lazy-carousel-dot-size    default 8px
  *   --lazy-carousel-dot-spacing default 8px
  *
  *   --lazy-carousel-image-border-radius    default 0px
  *   --lazy-carousel-image-background-color default var(--app-background-color, grey)
  *   --lazy-carousel-image-margin           default 0px
  *   --lazy-carousel-image-width            default 100%
  * 
  *
  *   nav btns, av btns and dots
  *   
  *   --lazy-carousel-ui-background-color default rgba(33, 33, 33, 0.3)
  *   --lazy-carousel-ui-color            default var(--constant-light-text, white)
  *   --lazy-carousel-ui-ink-color        default var(--constant-dark-text, #212121)
  *   
  *
  *   Api:
  *
  *     Properties:
  *
  *       aspect-ratio <String> 'landscape',   Width to height ratio.
  *                                            'classic'   --> 4:3
  *                                            'fill'      --> Same width and height of parent.
  *                                                            Dev must set height on <app-carousel>.  
  *                                            'landscape' --> 16:9
  *                                            'portrait'  --> 9:16
  *                                            'square'    --> Height equal to width.
  *
  *       autoplay     <Boolean> false,        Starts player immediately.
  *
  *       dots         <Boolean> false,        Section index ui dots.
  *
  *       flip-time    <Number>  3000,         Milliseconds to wait between each flip.
  *
  *       images       <Array>   undefined,    Main input as a collection of image objects.
  *
  *       nav          <Boolean> false,        Include nav ui.
  *
  *       position     <String>  'center',     How carousel positions elements relative to self.
  *
  *       sizing       <String>  'cover',      Image sizing type.
  *
  *       trigger      <Number>  0,            Distance, in px, from edge of carousel to start image download.
  *
  *       type         <String>  'lazy-image', Sets the underlying image element used for display.
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
  *
  *       From app-carousel...
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
  *       From lazy-carousel...
  *
  *       'lazy-carousel-image-clicked', {image, index}
  *         Fired when an image element is clicked.
  *
  *
  *
  * @customElement
  * @polymer
  * @demo demo/index.html
  *
  **/

import {AppElement, html} from '@longlost/app-core/app-element.js';
import htmlString         from './lazy-carousel.html';
import './app-carousel.js';
// 'lazy-image' and 'responsive-image' files imported dynamically.


class LazyCarousel extends AppElement {
  static get is() { return 'lazy-carousel'; }

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

      // Display navigation dots when true.
      dots: Boolean,

      // How many ms to wait between each flip.
      flipTime: {
        type: Number,
        value: 3000
      },

      // A collection of image objects.
      // ie. [
      //   {
      //     alt:         'My cool image.',
      //     placeholder: 'https://my-cool-images.com/my-cool-image_thumbnail.jpg' (optional but recommended)
      //     src:         'https://my-cool-images.com/my-cool-image.jpg'
      //   },
      //   ...
      // ]
      images: Array, 

      // Set to true to have clickable navigation arrows.
      nav: Boolean,

      // Where to place items relative to carousel.
      position: {
        type: String,
        value: 'center'
      },

      // Image sizing type.
      sizing: {
        type: String,
        value: 'cover' // or 'contain'
      },

      // The distance in pixels to pad
      // to the carousel trigger threshold.
      // For instance, 0 would mean that the
      // next lazy image would not start to download
      // until a single pixel intersects the edge of
      // the carousel.
      // Or 128 means that the image would start to
      // download 128px before the next image comes
      // into view.
      trigger: {
        type: Number,
        value: 0
      },

      // Image element type.
      // Use 'responsive-image' for static images
      // that are built into the app with webpack.
      // Use 'lazy-image' for dynamic images such 
      // as images downloaded from a database or
      // other external source.
      type: {
        type: String,
        value: 'lazy-image' // or 'responsive-image'
      },

      // Cached reference for app-carousel element.
      // Used to call carousel methods.
      _carousel: Object,

      // Drives both dom-if templates.
      _typeIsLazyImage: {
        type: Boolean,
        computed: '__computeTypeIsLazyImage(type)'
      }

    };
  }


  static get observers() {
    return [
      '__typeChanged(type)'
    ];
  }

  // For dom-if templates.
  __computeTypeIsLazyImage(type) {
    return type === 'lazy-image';
  }


  __typeChanged(type) {
    if (!type) { return; }

    if (this.type === 'responsive-image') {
      import(
        /* webpackChunkName: 'responsive-image' */ 
        '@longlost/app-images/responsive-image.js'
      );
    }
    else {
      import(
        /* webpackChunkName: 'lazy-image' */ 
        '@longlost/app-images/lazy-image.js'
      );
    }
  }


  __ifDomChange() {
    this._carousel = this.select('#carousel');
  }


  async __imageClicked(event) {
    try {
      await this.clicked();

      const {image, index} = event.model;
      this.fire('lazy-carousel-image-clicked', {image, index});
    }
    catch (error) {
      if (error === 'click debounced') { return; }
      console.error(error);
    }
  }


  __checkCarousel() {
    
    if (!this._carousel) {
      throw new Error('Carousel not stamped yet, please wait.');
    }    
  }


  animateToSection(index) {
    this.__checkCarousel();
    this._carousel.animateToSection(index);
  }


  moveToSection(index) {
    this.__checkCarousel();
    this._carousel.moveToSection(index);
  }


  nextItem(direction, recycle) {
    this.__checkCarousel();
    this._carousel.nextItem(direction, recycle);
  }


  play() {
    this.__checkCarousel();
    this._carousel.play();
  }


  stop() {
    this.__checkCarousel();
    this._carousel.stop();
  }

}

window.customElements.define(LazyCarousel.is, LazyCarousel);
