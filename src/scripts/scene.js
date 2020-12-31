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

    if (!self.parent.isEditor()) {
      if (self.index > 0) {
        const cornerLeft = document.createElement('div');
        cornerLeft.classList.add('h5p-book-maker-paper');
        cornerLeft.classList.add('h5p-book-maker-left');
        $wrapper.append(cornerLeft);
      }

      if (self.index < self.parent.getChildren().length - 1) {
        const cornerRight = document.createElement('div');
        cornerRight.classList.add('h5p-book-maker-paper');
        cornerRight.classList.add('h5p-book-maker-right');
        $wrapper.append(cornerRight);
      }
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
