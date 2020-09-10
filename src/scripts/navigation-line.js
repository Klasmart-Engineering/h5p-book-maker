import Printer from './printer';
import Controls from 'h5p-lib-controls/src/scripts/controls';
import UIKeyboard from 'h5p-lib-controls/src/scripts/ui/keyboard';
import { defaultValue, contains, isFunction, addClickAndKeyboardListeners, isIOS } from './utils';

/**
 * Enum indicating which state a navigation bar part is in
 * @enum {string}
 */
const answeredState = {
  NO_INTERACTIONS: 'none',
  NOT_ANSWERED: 'not-answered',
  ANSWERED: 'answered',
  CORRECT: 'has-only-correct',
  INCORRECT: 'has-incorrect'
};

/**
 * @class
 */
const NavigationLine = (function ($) {
  function NavigationLine(bookMaker) {
    this.bookMaker = bookMaker;

    this.initProgressbar();
    this.initFooter();
    this.initTaskAnsweredListener();
    this.toggleNextAndPreviousButtonDisabled(this.bookMaker.getCurrentSceneIndex());
  }

  /**
   * Initializes xAPI event listener, updates progressbar when a task is changed.
   */
  NavigationLine.prototype.initTaskAnsweredListener = function () {
    this.bookMaker.elementInstances.forEach((scene, index) => {
      scene
        .filter(interaction => isFunction(interaction.on))
        .forEach(interaction => {
          interaction.on('xAPI', (event) => {
            const shortVerb = event.getVerb();

            if (contains(['interacted', 'answered', 'attempted'], shortVerb)) {
              const isAnswered = false;
              this.setTaskAnswered(index, isAnswered);
            }
            else if (shortVerb === 'completed') {
              event.setVerb('answered');
            }

            if (event.data.statement.context.extensions === undefined) {
              event.data.statement.context.extensions = {};
            }

            event.data.statement.context.extensions['http://id.tincanapi.com/extension/ending-point'] = index + 1;
          });
        });
    });
  };

  /**
   * Initialize progress bar
   */
  NavigationLine.prototype.initProgressbar = function () {
    const that = this;
    const currentSceneIndex = (that.bookMaker.previousState && that.bookMaker.previousState.progress) || 0;

    this.progresbarKeyboardControls = new Controls([new UIKeyboard()]);
    this.progresbarKeyboardControls.negativeTabIndexAllowed = true;
    this.progresbarKeyboardControls.on('select', event => {
      that.displayScene($(event.element).data('sceneNumber'));
    });

    // if last element, prevent next progression
    this.progresbarKeyboardControls.on('beforeNextElement', event => event.index !== (event.elements.length - 1));

    // if first element, prevent previous progression
    this.progresbarKeyboardControls.on('beforePreviousElement', event => event.index !== 0);

    // Remove existing progressbar
    if (this.bookMaker.progressbarParts !== undefined && this.bookMaker.progressbarParts) {
      this.bookMaker.progressbarParts.forEach(function (part) {
        that.progresbarKeyboardControls.removeElement(part.children('a').get(0));
        part.remove();
      });
    }

    that.bookMaker.progressbarParts = [];

    const clickProgressbar = function (event) {
      event.preventDefault();
      const index = $(this).data('sceneNumber');
      that.progresbarKeyboardControls.setTabbableByIndex(index);
      that.displayScene(index);
      that.bookMaker.focus();
    };

    for (let i = 0; i < this.bookMaker.scenes.length; i += 1) {
      const progressbarPartTitle = this.createSceneTitle(i);

      // create list item
      const $li = $('<li>', {
        'class': 'h5p-progressbar-part'
      })
        .appendTo(that.bookMaker.$progressbar);

      // create link
      const $link = $('<a>', {
        href: '#',
        html: '<span class="h5p-progressbar-part-title hidden-but-read">' + progressbarPartTitle + '</span>',
        tabindex: '-1'
      }).data('sceneNumber', i)
        .click(clickProgressbar)
        .appendTo($li);

      this.progresbarKeyboardControls.addElement($link.get(0));

      // Add hover effect if not an ipad or iphone.
      if (!isIOS) {
        // create popup
        const $popup = $('<div/>', {
          'class': 'h5p-progressbar-popup',
          'html': progressbarPartTitle,
          'aria-hidden': 'true'
        }).appendTo($li);

        $li.mouseenter(() => this.ensurePopupVisible($popup));
      }

      if (i === 0) {
        $li.addClass('h5p-progressbar-part-show');
      }

      if (i === currentSceneIndex) {
        $li.addClass('h5p-progressbar-part-selected');
      }

      that.bookMaker.progressbarParts.push($li);

      this.updateSceneTitle(i);
    }
  };

  /**
   * Ensures that all of a popup is visible
   *
   * @param {jQuery} $popup
   */
  NavigationLine.prototype.ensurePopupVisible = function ($popup) {
    const availableWidth = this.bookMaker.$container.width();
    const popupWidth = $popup.outerWidth();
    const popupOffsetLeft = $popup.offset().left;

    if (popupOffsetLeft < 0) {
      $popup.css('left', 0);
      $popup.css('transform', 'translateX(0)');
    }
    else if ((popupOffsetLeft + popupWidth) > availableWidth) {
      $popup.css('left', 'auto');
      $popup.css('right', 0);
      $popup.css('transform', 'translateX(0)');
    }
  };

  /**
   * Displays a scene
   *
   * @param {number} index
   */
  NavigationLine.prototype.displayScene = function (index) {
    const oldIndex = this.bookMaker.getCurrentSceneIndex();

    // update current progress task
    this.updateSceneTitle(index, { isCurrent: true });

    // update old progress task
    this.updateSceneTitle(oldIndex, { isCurrent: false });

    // navigate to scene
    this.bookMaker.jumpToScene(index);

    // toggle next and prev buttons
    this.toggleNextAndPreviousButtonDisabled(index);
  };

  /**
   * Generate tooltip for progress bar scenes
   *
   * @param {number} sceneNumber
   * @return {string}
   */
  NavigationLine.prototype.createSceneTitle = function (sceneNumber) {
    return this.bookMaker.l10n.scene + ' ' + (sceneNumber + 1);
  };


  /**
   * Initialize footer.
   */
  NavigationLine.prototype.initFooter = function () {
    var that = this;
    var $footer = this.bookMaker.$footer;

    // Inner footer adjustment containers
    $('<div/>', {
      'class': 'h5p-footer-left-adjusted'
    }).appendTo($footer);

    var $centerFooter = $('<div/>', {
      'class': 'h5p-footer-center-adjusted'
    }).appendTo($footer);

    var $rightFooter = $('<div/>', {
      'role': 'toolbar',
      'class': 'h5p-footer-right-adjusted'
    }).appendTo($footer);

    // Center footer elements

    // Previous scene
    this.bookMaker.$prevSceneButton = $('<div/>', {
      'class': 'h5p-footer-button h5p-footer-previous-scene',
      'aria-label': this.bookMaker.l10n.prevScene,
      'title': this.bookMaker.l10n.prevScene,
      'role': 'button',
      'tabindex': '-1',
      'aria-disabled': 'true'
    }).appendTo($centerFooter);

    addClickAndKeyboardListeners(this.bookMaker.$prevSceneButton, () => this.bookMaker.previousScene());

    const $sceneNumbering = $('<div/>', {
      'class': 'h5p-footer-scene-count'
    }).appendTo($centerFooter);

    // Current scene count
    this.bookMaker.$footerCurrentScene = $('<div/>', {
      'html': '1',
      'class': 'h5p-footer-scene-count-current',
      'title': this.bookMaker.l10n.currentScene,
      'aria-hidden': 'true'
    }).appendTo($sceneNumbering);

    this.bookMaker.$footerCounter = $('<div/>', {
      'class': 'hidden-but-read',
      'html': this.bookMaker.l10n.sceneCount
        .replace('@index', '1')
        .replace('@total', this.bookMaker.scenes.length.toString())
    }).appendTo($centerFooter);

    // Count delimiter, content configurable in css
    $('<div/>', {
      'html': '/',
      'class': 'h5p-footer-scene-count-delimiter',
      'aria-hidden': 'true'
    }).appendTo($sceneNumbering);

    // Max scene count
    this.bookMaker.$footerMaxScene = $('<div/>', {
      'html': this.bookMaker.scenes.length,
      'class': 'h5p-footer-scene-count-max',
      'title': this.bookMaker.l10n.lastScene,
      'aria-hidden': 'true'
    }).appendTo($sceneNumbering);

    // Next scene
    this.bookMaker.$nextSceneButton = $('<div/>', {
      'class': 'h5p-footer-button h5p-footer-next-scene',
      'aria-label': this.bookMaker.l10n.nextScene,
      'title': this.bookMaker.l10n.nextScene,
      'role': 'button',
      'tabindex': '0'
    }).appendTo($centerFooter);

    addClickAndKeyboardListeners(this.bookMaker.$nextSceneButton, () => this.bookMaker.nextScene());

    // *********************
    // Right footer elements
    // *********************

    // Do not add these buttons in editor mode
    if (this.bookMaker.editor === undefined) {
      if (this.bookMaker.enablePrintButton && Printer.supported()) {
        this.bookMaker.$printButton = $('<div/>', {
          'class': 'h5p-footer-button h5p-footer-print',
          'aria-label': this.bookMaker.l10n.printTitle,
          'title': this.bookMaker.l10n.printTitle,
          'role': 'button',
          'tabindex': '0'
        }).appendTo($rightFooter);

        addClickAndKeyboardListeners(this.bookMaker.$printButton, () => that.openPrintDialog());
      }

      if (H5P.fullscreenSupported) {
        // Toggle full screen button
        this.bookMaker.$fullScreenButton = $('<div/>', {
          'class': 'h5p-footer-button h5p-footer-toggle-full-screen',
          'aria-label': this.bookMaker.l10n.fullscreen,
          'title': this.bookMaker.l10n.fullscreen,
          'role': 'button',
          'tabindex': '0'
        });

        addClickAndKeyboardListeners(this.bookMaker.$fullScreenButton, () => that.bookMaker.toggleFullScreen());

        this.bookMaker.$fullScreenButton.appendTo($rightFooter);
      }
    }
  };


  NavigationLine.prototype.openPrintDialog = function () {
    const $h5pWrapper = $('.h5p-wrapper');
    const $dialog = Printer.showDialog(this.bookMaker.l10n, $h5pWrapper, (printAllScenes) => {
      Printer.print(this.bookMaker, $h5pWrapper, printAllScenes);
    });

    $dialog.children('[role="dialog"]').focus();
  };

  /**
   * Updates progress bar.
   */
  NavigationLine.prototype.updateProgressBar = function (sceneNumber, prevSceneNumber) {
    var that = this;

    // Updates progress bar progress (blue line)
    var i;
    for (i = 0; i < that.bookMaker.progressbarParts.length; i += 1) {
      if (sceneNumber + 1 > i) {
        that.bookMaker.progressbarParts[i].addClass('h5p-progressbar-part-show');
      }
      else {
        that.bookMaker.progressbarParts[i].removeClass('h5p-progressbar-part-show');
      }
    }

    that.progresbarKeyboardControls.setTabbableByIndex(sceneNumber);

    that.bookMaker.progressbarParts[sceneNumber]
      .addClass("h5p-progressbar-part-selected")
      .siblings().removeClass("h5p-progressbar-part-selected");

    if (prevSceneNumber === undefined) {
      that.bookMaker.progressbarParts.forEach(function (part, i) {
        that.setTaskAnswered(i, false);
      });
      return;
    }
  };

  /**
   * Sets a part to be answered, or un answered
   *
   * @param {number} index
   * @param {boolean} isAnswered
   */
  NavigationLine.prototype.setTaskAnswered = function (index, isAnswered) {
    const $answeredIndicator = this.bookMaker.progressbarParts[index].find('.h5p-progressbar-part-has-task');

    $answeredIndicator.toggleClass('h5p-answered', isAnswered);
    this.updateSceneTitle(index);
  };

  /**
   * Updates a scene's title with values from state, if overrides are not provided
   *
   * @param {number} index
   * @param {object} [config]
   * @param {answeredState} [config.state]
   * @param {boolean} [config.isCurrent]
   */
  NavigationLine.prototype.updateSceneTitle = function (index, { isCurrent } = {}) {
    this.setSceneTitle(index, {
      isCurrent: defaultValue(isCurrent, this.bookMaker.isCurrentScene(index))
    });
  };

  /**
   * Sets a part to be answered, or un answered
   *
   * @param {number} index
   * @param {answeredState} [state]
   * @param {boolean} [isCurrent]
   */
  NavigationLine.prototype.setSceneTitle = function (index, {isCurrent = false}) {
    const total =  this.bookMaker.scenes.length;
    const $part = this.bookMaker.progressbarParts[index];
    const $partTitle = $part.find('.h5p-progressbar-part-title');
    const numberedLabel = this.bookMaker.l10n.sceneCount.replace('@index', (index + 1)).replace('@total', total);
    const currentSceneLabel = isCurrent ? this.bookMaker.l10n['currentScene'] : '';

    $partTitle.html(`${numberedLabel}: ${currentSceneLabel}`);
  };

  /**
   * Update footer with current scene data
   *
   * @param {Number} sceneNumber Current scene number
   */
  NavigationLine.prototype.updateFooter = function (sceneNumber) {
    // Update current scene number in footer
    this.bookMaker.$footerCurrentScene.html(sceneNumber + 1);
    this.bookMaker.$footerMaxScene.html(this.bookMaker.scenes.length);

    this.bookMaker.$footerCounter.html(this.bookMaker.l10n.sceneCount
      .replace('@index', (sceneNumber + 1).toString())
      .replace('@total', this.bookMaker.scenes.length.toString()));

    this.toggleNextAndPreviousButtonDisabled(sceneNumber);
  };

  /**
   * Disables previous button if on the first scene,
   * and disables the next button if on the last scene
   *
   * @param {number} index
   */
  NavigationLine.prototype.toggleNextAndPreviousButtonDisabled = function (index) {
    const lastSceneIndex = this.bookMaker.scenes.length - 1;

    this.bookMaker.$prevSceneButton.attr('aria-disabled', (index === 0).toString());
    this.bookMaker.$nextSceneButton.attr('aria-disabled', (index === lastSceneIndex).toString());
    this.bookMaker.$prevSceneButton.attr('tabindex', (index === 0) ? '-1' : '0');
    this.bookMaker.$nextSceneButton.attr('tabindex', (index === lastSceneIndex) ? '-1' : '0');
  };

  return NavigationLine;
})(H5P.jQuery);

export default NavigationLine;
