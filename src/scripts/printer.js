import { addClickAndKeyboardListeners } from './utils';

const Printer = (function ($) {
  let nextPrinterDialogId = 0;

  /**
   * Printer class
   * @class Printer
   */
  function Printer() {}

  /**
   * Check if printing is supported
   *
   * @method supported
   * @static
   * @return {boolean} True if supported, else false.
   */
  Printer.supported = function () {
    // Need window.print to be available
    return (typeof window.print === 'function');
  };

  /**
   * Do the actual printing
   *
   * @method print
   * @static
   * @param  {H5P.BookMaker} bookMaker Reference to bookMaker instance
   * @param  {H5P.jQuery} $wrapper  The CP dom wrapper
   * @param  {boolean} allScenes If true, all scenes are printed. If false or
   *                             undefined, the currentScene is printed.
   */
  Printer.print = function (bookMaker, $wrapper, allScenes) {
    // Let CP know we are about to print
    bookMaker.trigger('printing', {finished: false, allScenes: allScenes});

    // Find height of a scene:
    var $currentScene = $('.h5p-scene.h5p-current');
    var sceneHeight = $currentScene.height();
    var sceneWidth = $currentScene.width();

    // Use 670px as width when printing. We can't use 100% percent, since user can
    // change between landscape and portrait without us ever knowing about it.
    // More info: http://stackoverflow.com/a/11084797/2797106
    var ratio = sceneWidth / 670;

    var $scenes = $('.h5p-scene');

    $scenes.css({
      height: sceneHeight / ratio + 'px',
      width: '670px',
      fontSize: Math.floor(100 / ratio) + '%'
    });

    var wrapperHeight = $wrapper.height();
    $wrapper.css('height', 'auto');

    // Let printer css know which scenes to print:
    $scenes.toggleClass('doprint', allScenes === true);
    $currentScene.addClass('doprint');

    // Need timeout for some browsers.
    setTimeout(function () {
      // Do the actual printing of the iframe content
      window.print();

      // Reset CSS
      $scenes.css({
        height: '',
        width: '',
        fontSize: ''
      });
      $wrapper.css('height', wrapperHeight + 'px');

      // Let CP know we are finished printing
      bookMaker.trigger('printing', {finished: true});
    }, 500);
  };

  /**
   * Show the print dialog. Wanted to use H5P.Dialog, but it does not support getting a jQuery object as the content
   *
   * @method showDialog
   * @param  {object}       texts    Translated texts
   * @param  {H5P.jQuery}   $element Dom object to insert dialog after
   * @param  {Function}     callback Function invoked when printing is done.
   */
  Printer.showDialog = function (texts, $element, callback) {
    var self = this;
    const instanceId = nextPrinterDialogId++;
    const dialogTitleId = `h5p-book-maker-print-dialog-${instanceId}-title`;
    const ingressId = `h5p-book-maker-print-dialog-${instanceId}-ingress`;

    var $dialog = $(`<div class="h5p-popup-dialog h5p-print-dialog">
                      <div role="dialog" aria-labelledby="${dialogTitleId}" aria-describedby="${ingressId}" tabindex="-1" class="h5p-inner">
                        <h2 id="${dialogTitleId}">${texts.printTitle}</h2>
                        <div class="h5p-scroll-content"></div>
                        <div class="h5p-close" role="button" tabindex="0" title="${H5P.t('close')}">
                      </div>
                    </div>`)
      .insertAfter($element)
      .click(function () {
        self.close();
      })
      // prevent propagation inside inner
      .children('.h5p-inner')
      .click(function () {
        return false;
      })
      .end();

    addClickAndKeyboardListeners($dialog.find('.h5p-close'), () => self.close());

    var $content = $dialog.find('.h5p-scroll-content');

    $content.append($('<div>', {
      'class': 'h5p-book-maker-print-ingress',
      id: ingressId,
      html: texts.printIngress
    }));

    H5P.JoubelUI.createButton({
      html: texts.printAllScenes,
      'class': 'h5p-book-maker-print-all-scenes',
      click: function () {
        self.close();
        callback(true);
      }
    }).appendTo($content);

    H5P.JoubelUI.createButton({
      html: texts.printCurrentScene,
      'class': 'h5p-book-maker-print-current-scene',
      click: function () {
        self.close();
        callback(false);
      }
    }).appendTo($content);

    this.open = function () {
      setTimeout(function () {
        $dialog.addClass('h5p-open'); // Fade in
        // Triggering an event, in case something has to be done after dialog has been opened.
        H5P.jQuery(self).trigger('dialog-opened', [$dialog]);
      }, 1);
    };

    this.close = function () {
      $dialog.removeClass('h5p-open'); // Fade out
      setTimeout(function () {
        $dialog.remove();
      }, 200);
    };

    this.open();

    return $dialog;
  };

  return Printer;

})(H5P.jQuery);

export default Printer;
