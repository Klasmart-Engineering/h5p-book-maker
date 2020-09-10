import Element from './element.js';
import Parent from 'h5p-parent';

/**
 * @class
 */
function Scene(parameters) {
  const self = this;
  Parent.call(self, Element, parameters.elements);

  // The scene DOM element when attached
  let $wrapper;

  /**
   * Create HTML
   *
   * @return {jQuery} Element
   */
  self.getElement = function () {
    if (!$wrapper) {
      $wrapper = H5P.jQuery(Scene.createHTML(parameters));
    }
    return $wrapper;
  };

  /**
   * Make current scene
   */
  self.setCurrent = function () {
    this.parent.$current = $wrapper.addClass('h5p-current');
  };

  /**
   * Append all of the elements to the scene.
   */
  self.appendElements = function () {

    for (let i = 0; i < self.children.length; i++) {
      self.parent.attachElement(parameters.elements[i], self.children[i].instance, $wrapper, self.index);
    }

    self.parent.elementsAttached[self.index] = true;
    self.parent.trigger('domChanged', {
      '$target': $wrapper,
      'library': 'BookMaker',
      'key': 'newScene'
    }, {'bubbles': true, 'external': true});
  };
}

/**
 * Creates the HTML for a single scene.
 *
 * @param {Object} params Scene parameters.
 * @returns {string} HTML.
 */
Scene.createHTML = function (parameters) {
  return '<div role="document" class="h5p-scene"' + (parameters.background !== undefined ? ' style="background:' + parameters.background + '"' : '') + '></div>';
};

export default Scene;
