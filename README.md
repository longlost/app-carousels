# app-carousels
A collection of easy to use carousel UI elements.


# \<app-carousel\>

This element takes slotted elements and controls how they scroll horizontally.

## Example Usage

```
<app-carousel auto-play 
        dots
        flip-time="3500"
        nav 
        position="start">
  <my-carousel-item></my-carousel-item>
  <my-carousel-item></my-carousel-item>
  <my-carousel-item></my-carousel-item>
</app-carousel>
```

## Styling


Since the scroller element is **'display: flex'**, 
you may have to set a **'min-width'**
on your elements to get the desired layout.


### Both default to 8px.


--carousel-dot-size

--carousel-dot-spacing



### Nav butons and Dots, plus Play/Stop icons.

--carousel-ui-color

--carousel-ui-background-color

--carousel-ui-ink-color


## Public Api

### Properties:

**auto-play**
 Boolean false,   Starts player immediately.

**dots**
 Boolean false,   Section index ui dots.
 
**flip-time**
 Number  3000,    Milliseconds to wait between each flip.

**nav**
 Boolean false,   Include nav ui.

**position**
 String 'center', How carousel positions elements relative to self.



### Methods:
    
 **animateToSection(index)**
  Animate to a given section by index number.
 
 **moveToSection(index)**
  Instant move to a given section by index number.
 
 **nextItem(direction, recycle)**
  Animate to next slide, pass in direction and if it should wrap from last slide to begining slide.
 
 **play()**
  Start carousel flips.
 
 **stop()**
  Stop carousel flips.



### Events:

 **'app-carousel-centered-item-changed'**, {value: item}
  Fired each time a new element becomes centered in the carousel.
  
 **'app-carousel-section-index-changed'**, {value: index}
  Fired each time the section index changes.
  
 **'app-carousel-sections-changed'**,      {value: sections}
  Fired each time items in the carousel change, thus triggering new section items creation.

---

## Install the Polymer-CLI

First, make sure you have the [Polymer CLI](https://www.npmjs.com/package/polymer-cli) and npm (packaged with [Node.js](https://nodejs.org)) installed. Run `npm install` to install your element's dependencies, then run `polymer serve` to serve your element locally.

## Viewing Your Element

```
$ polymer serve
```

## Running Tests

```
$ polymer test
```

Your application is already set up to be tested via [web-component-tester](https://github.com/Polymer/web-component-tester). Run `polymer test` to run your application's test suite locally.
