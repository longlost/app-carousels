

import htmlString from './carousel-shared-styles.html';

const sharedStyles = document.createElement('dom-module');

sharedStyles.innerHTML = htmlString;
sharedStyles.register('carousel-shared-styles');
