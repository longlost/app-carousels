
import '@polymer/iron-iconset-svg/iron-iconset-svg.js';
import htmlString from './carousel-icons.html';

const appCarouselIcons 		 = document.createElement('div');
appCarouselIcons.innerHTML = htmlString;
appCarouselIcons.setAttribute('style', 'display: none;');
document.head.appendChild(appCarouselIcons);
