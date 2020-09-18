import { jQuery as $ } from './globals';

/**
 * Flattens a nested array
 *
 * Example:
 * [['a'], ['b']].flatten() -> ['a', 'b']
 *
 * @param {Array} arr A nested array
 * @returns {Array} A flattened array
 */
export const flattenArray = arr => arr.concat.apply([], arr);

/**
 * Returns true if the argument is a function
 *
 * @param {Function|*} f
 */
export const isFunction = f => typeof f === 'function';


/**
 * Makes a string kebab case
 *
 * @param {string} str
 * @return {string}
 */
export const kebabCase = str => str.replace(/[\W]/g, '-');

/**
 * Is true if the users device is an ipad
 *
 * @const {boolean}
 */
export const isIPad = navigator.userAgent.match(/iPad/i) !== null;


/**
 * Is true if the users device is an iOS device
 *
 * @const {boolean}
 */
export const isIOS = navigator.userAgent.match(/iPad|iPod|iPhone/i) !== null;

/**
 * Returns true if the array contains the value
 *
 * @template T
 * @param {Array.<T>} arr
 * @param {T} val
 * @return {boolean}
 */
export const contains = (arr, val) => arr.indexOf(val) !== -1;

/**
 * Returns a default value if provided value is undefined
 *
 * @template T
 * @param {T} value
 * @param {T} fallback
 * @return {T}
 */
export const defaultValue = (value, fallback) => (value !== undefined) ? value : fallback;

/**
 * Enum for keyboard key codes
 * @readonly
 * @enum {number}
 */
export const keyCode = {
  ENTER: 13,
  ESC: 27,
  SPACE: 32
};

/**
 * Make a non-button element behave as a button. I.e handle enter and space
 * keydowns as click
 *
 * @param  {H5P.jQuery} $element The "button" element
 * @param  {function(Event)} callback
 * @param  {*} [scope]
 */
export const addClickAndKeyboardListeners = function ($element, callback, scope) {
  $element.click(function (event) {
    callback.call(scope || this, event);
  });

  $element.keydown(function (event) {
    if (contains([keyCode.ENTER, keyCode.SPACE], event.which)) {
      event.preventDefault();
      callback.call(scope || this, event);
    }
  });
};

/**
 * @const {H5P.jQuery}
 */
const $STRIP_HTML_HELPER = $('<div>');

/**
 * Strips the html from a string, using jquery
 *
 * @param {string} str
 * @return {string}
 */
export const stripHTML = str => $STRIP_HTML_HELPER.html(str).text().trim();

/**
 * Check whether an ancestor is in fact an ancestor of a descendant.
 * @param {HTMLElement} descendant Node to check for ancestor.
 * @param {HTMLElement} ancestor Node to check for.
 * @return {null|HTMLElement} Ancestor element if it is ancestor.
 */
export const checkAncestor = (descendant, ancestor) => {
  if (!descendant || !ancestor) {
    return null;
  }

  if (descendant === ancestor || descendant.parentNode === ancestor) {
    return ancestor;
  }

  if (!descendant.parentNode) {
    return null;
  }

  return checkAncestor(descendant.parentNode, ancestor);
};

/**
 * Check whether a node is (inside) a draggable element.
 * @param {HTMLElement} node Node to check.
 * @return {boolean} True, if node is (inside) a draggable element.
 */
export const isDraggable = (node) => {
  if (!node || !node.classList) {
    return false;
  }

  if (node.classList.contains('h5p-book-maker-draggable-element')) {
    return true;
  }

  return (node.parentNode) ? isDraggable(node.parentNode) : false;
};
