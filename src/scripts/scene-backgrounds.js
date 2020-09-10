import { jQuery as $ } from './globals';

/**
 * @class
 */
export default class  {
  /**
   * Create a Scene specific background selector
   *
   * @param {H5P.BookMaker} bookMaker Book Maker instance
   */
  constructor(bookMaker) {
    var params = bookMaker.book;

    // Extend defaults
    params = $.extend(true, {
      globalBackgroundSelector: {
        fillGlobalBackground: "",
        imageGlobalBackground: {}
      },
      scenes: [
        {
          sceneBackgroundSelector: {
            fill: "",
            image: {}
          }
        }
      ]
    }, params);

    /**
     * Set global background
     * @private
     */
    var setGlobalBackground = function () {
      var globalSettings = params.globalBackgroundSelector;
      setBackground(globalSettings.fillGlobalBackground, globalSettings.imageGlobalBackground);
    };

    /**
     * Set single scene background
     * @private
     */
    var sets = function () {
      params.scenes.forEach(function (sceneParams, idx) {
        var bgParams = sceneParams.sceneBackgroundSelector;
        if (bgParams) {
          setBackground(bgParams.fill, bgParams.image, idx);
        }
      });
    };

    /**
     * Set background of scene(s)
     *
     * @private
     * @param {Object} fillSettings Background color settings
     * @param {Object} imageSettings Image background settings
     * @param {number} [index] Optional target scene index, otherwise all scenes.
     */
    var setBackground = function (fillSettings, imageSettings, index) {
      var $updateScenes = bookMaker.$scenesWrapper.children();

      if (index !== undefined) {
        $updateScenes = $updateScenes.eq(index);
      }

      if (fillSettings && fillSettings !== "") {

        // Fill with background color
        $updateScenes.addClass('has-background')
          .css('background-image', '')
          .css('background-color', fillSettings);
      }
      else if (imageSettings && imageSettings.path) {

        // Fill with image
        $updateScenes.addClass('has-background')
          .css('background-color', '')
          .css('background-image', 'url(' + H5P.getPath(imageSettings.path, bookMaker.contentId) + ')');
      }
    };

    // Set backgrounds
    setGlobalBackground();
    sets();
  }
}
