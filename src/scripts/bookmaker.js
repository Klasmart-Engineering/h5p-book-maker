import Parent from 'h5p-parent';
import NavigationLine from './navigation-line';
import NavigationBar from './navigation-bar';
import SceneBackground from './scene-backgrounds';
import { jQuery as $ } from './globals';
import { addClickAndKeyboardListeners, isFunction, kebabCase, keyCode, checkAncestor, isDraggable } from './utils';
import Scene from './scene.js';

/**
 * Constructor.
 *
 * @param {object} params Start paramteres.
 * @param {int} id Content identifier
 * @param {function} editor
 *  Set if an editor is initiating this library
 * @returns {undefined} Nothing.
 */
let BookMaker = function (params, id, extras) {
  var that = this;
  this.book = params.book;
  this.scenes = this.book.scenes;
  this.contentId = id;
  this.elementInstances = []; // elementInstances holds the instances for elements in an array.
  this.elementsAttached = []; // Map to keep track of which scene has attached elements
  this.hasAnswerElements = false;
  this.ignoreResize = false;

  if (extras.bookMakerEditor) {
    this.editor = extras.bookMakerEditor;
  }

  this.audioReferences = [];

  if (!this.editor) {
    params.book.scenes.forEach(scene => {
      if (!scene.elements) {
        return;
      }

      scene.elements.forEach(element => {
        const libraryName = (element.action && element.action.library) ? element.action.library.split(' ')[0] : null;
        if (!libraryName || libraryName !== 'H5P.Audio') {
          return;
        }

        if (!element.canBeChangedByUser) {
          return; // This Audio cannot be changed
        }

        // Inject AudioRecorder for Audio
        const recorderElement = {
          backgroundOpacity: 0,
          displayAsButton: true,
          height: 8.88887, // TODO: Find better size/height/position
          width: 5,
          x: element.x + element.width - 5 / 2,
          y: element.y - 8.88887 / 2,
          action: {
            library: "H5P.AudioRecorderBookMaker 1.0", // TODO: Get version number from somewhere?
            metadata: {
              contentType: 'AudioRecorderBookMaker', license: 'U', title: 'Untitled Audio Recorder'
            },
            params: {
              l10n: {
                recordAnswer: 'Record',
                pause: 'Pause',
                continue: 'Continue',
                download: 'Use',
                done: 'Done',
                retry: 'Retry',
                microphoneNotSupported: 'Microphone not supported. Make sure you are using a browser that allows microphone recording.',
                microphoneInaccessible: 'Microphone is not accessible. Make sure that the browser microphone is enabled.',
                insecureNotAllowed: 'Access to microphone is not allowed in your browser since this page is not served using HTTPS. Please contact the author, and ask him to make this available using HTTPS',
                statusReadyToRecord: 'Press a button below to record your answer.',
                statusRecording: 'Recording...',
                statusPaused: 'Recording paused. Press a button to continue recording.',
                statusFinishedRecording: 'You have successfully recorded your answer! Listen to the recording below.',
                downloadRecording: 'Download this recording or retry.',
                retryDialogHeaderText: 'Retry recording?',
                retryDialogBodyText: 'By pressing "Retry" you will lose your current recording.',
                retryDialogConfirmText: 'Retry',
                retryDialogCancelText: 'Cancel',
                statusCantCreateTheAudioFile: 'Can\'t create the audio file.'
              }
            },
            subContentId: H5P.createUUID()
          }
        };

        scene.elements = scene.elements.concat(recorderElement);
      });
    });
  }
  else {
    this.editor.on('removeScene', event => {
      this.$scenesWrapper.children().eq(event.data).remove();
    });
  }

  if (extras) {
    this.previousState = extras.previousState;
  }

  this.currentSceneIndex = (this.previousState && this.previousState.progress) ? this.previousState.progress : 0;

  this.l10n = $.extend({
    scene: 'Scene',
    retry: 'Retry',
    close: 'Close',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
    prevScene: 'Previous scene',
    nextScene: 'Next scene',
    currentScene: 'Current scene',
    lastScene: 'Last scene',
    printTitle: 'Print',
    printIngress: 'How would you like to print this presentation?',
    printAllScenes: 'Print all scenes',
    printCurrentScene: 'Print current scene',
    noTitle: 'No title',
    accessibilitySceneNavigationExplanation: 'Use left and right arrow to change scene in that direction whenever canvas is selected.',
    sceneCount: 'Scene @index of @total',
    accessibilityCanvasLabel: 'Presentation canvas. Use left and right arrow to move between scenes.'
  }, params.l10n !== undefined ? params.l10n : {});

  if (!!params.override) {
    this.enablePrintButton = !!params.override.enablePrintButton;
  }

  this.players = [];

  // Set override for all actions
  this.setElementsOverride(params.override);

  // Inheritance
  Parent.call(this, Scene, params.book.scenes);

  this.on('resize', this.resize, this);

  this.on('printing', function (event) {
    that.ignoreResize = !event.data.finished;

    if (event.data.finished) {
      that.resize();
    }
    else if (event.data.allScenes) {
      that.attachAllElements();
    }
  });
};

BookMaker.prototype = Object.create(Parent.prototype);
BookMaker.prototype.constructor = BookMaker;

/**
 * Render the presentation inside the given container.
 *
 * @param {H5P.jQuery} $container Container for this presentation.
 * @returns {undefined} Nothing.
 */
BookMaker.prototype.attach = function ($container) {
  var that = this;

  // isRoot is undefined in the editor
  if (this.isRoot !== undefined && this.isRoot()) {
    this.setActivityStarted();
  }

  var html =
          '<div class="h5p-keymap-explanation hidden-but-read">' + this.l10n.accessibilitySceneNavigationExplanation + '</div>' +
          '<div class="h5p-fullscreen-announcer hidden-but-read" aria-live="polite"></div>' +
          '<div class="h5p-wrapper" tabindex="0" aria-label="' + this.l10n.accessibilityCanvasLabel + '">' +
          '  <div class="h5p-current-scene-announcer hidden-but-read" aria-live="polite"></div>' +
          '  <div tabindex="-1"></div>' +
          '  <div class="h5p-box-wrapper">' +
          '    <div class="h5p-presentation-wrapper">' +
          '     <div class="h5p-scenes-wrapper"></div>' +
          '    </div>' +
          '  </div>' +
          '  <nav class="h5p-book-maker-navigation">' +
          '    <ol class="h5p-progressbar list-unstyled"></ol>' +
          '  </nav>' +
          '  <div class="h5p-footer"></div>' +
          '</div>';

  $container
    .attr('role', 'application')
    .addClass('h5p-book-maker')
    .html(html);

  this.$container = $container;
  this.$sceneAnnouncer = $container.find('.h5p-current-scene-announcer');
  this.$fullscreenAnnouncer = $container.find('.h5p-fullscreen-announcer');
  this.$sceneTop = this.$sceneAnnouncer.next();
  this.$wrapper = $container.children('.h5p-wrapper').focus(function () {
    that.initKeyEvents();
  }).blur(function () {
    if (that.keydown !== undefined) {
      H5P.jQuery('body').unbind('keydown', that.keydown);
      delete that.keydown;
    }
  }).click(function (event) {
    var $target = H5P.jQuery(event.target);

    /*
     * Add focus to the wrapper so that it may capture keyboard events unless
     * the target or one of its parents should handle focus themselves.
     */
    const isFocusableElement = that.belongsToTagName(
      event.target, ['input', 'textarea', 'a', 'button'], event.currentTarget);
    // Does the target element have a tabIndex set?
    const hasTabIndex = that.belongsToTabIndexed(event.target);

    // The dialog container (if within a dialog)
    const $dialogParent = $target.closest('.h5p-popup-container');
    // Is target within a dialog
    const isWithinDialog = $dialogParent.length !== 0;

    if (!isFocusableElement && !hasTabIndex && !that.editor) {
      if (!isWithinDialog) {
        // We're not within a dialog, so we can seafely put focus on wrapper
        that.$wrapper.focus();
      }
      else {
        // Find the closest tabbable parent element
        const $tabbable = $target.closest('[tabindex]');
        // Is the parent tabbable element inside the popup?
        if ($tabbable.closest('.h5p-popup-container').length === 1) {
          // We'll set focus here
          $tabbable.focus();
        }
        else {
          // Fallback: set focus on close button
          $dialogParent.find('.h5p-close-popup').focus();
        }
      }
    }
  });

  this.on('exitFullScreen', () => {
    this.$footer.removeClass('footer-full-screen');
    this.$fullScreenButton.attr('title', this.l10n.fullscreen);
    this.$fullscreenAnnouncer.html(this.l10n.accessibilityExitedFullscreen);
  });

  this.on('enterFullScreen', () => {
    this.$fullscreenAnnouncer.html(this.l10n.accessibilityEnteredFullscreen);
  });

  // Get intended base width from CSS.
  var wrapperWidth = parseInt(this.$wrapper.css('width'));
  this.width = wrapperWidth !== 0 ? wrapperWidth : 640;

  var wrapperHeight = parseInt(this.$wrapper.css('height'));
  this.height = wrapperHeight !== 0 ? wrapperHeight : 400;

  this.ratio = 16 / 9;
  // Intended base font size cannot be read from CSS, as it might be modified
  // by mobile browsers already. (The Android native browser does this.)
  this.fontSize = 16;

  this.$boxWrapper = this.$wrapper.children('.h5p-box-wrapper');
  var $presentationWrapper = this.$boxWrapper.children('.h5p-presentation-wrapper');
  this.$scenesWrapper = $presentationWrapper.children('.h5p-scenes-wrapper');
  this.$progressbar = this.$wrapper.find('.h5p-progressbar');
  this.$footer = this.$wrapper.children('.h5p-footer');

  // Create scenes
  this.createScenes();

  // We have always attached all elements in current scene
  this.elementsAttached[this.currentSceneIndex] = true;

  // Initialize touch events
  this.initTouchEvents();

  // init navigation line
  this.navigationLine = new NavigationLine(this);

  // Set scene title if initing in scene 0
  if (!this.previousState || !this.previousState.progress) {
    this.setSceneNumberAnnouncer(0, false);
  }

  if (!this.isEditor()) {
    this.createNavigationBars();
    this.createFullScreenButton();

    this.$wrapper.find('.h5p-book-maker-navigation').hide();
    this.$footer.hide();
  }

  new SceneBackground(this);

  if (this.previousState && this.previousState.progress) {
    this.jumpToScene(this.previousState.progress);
  }

  setTimeout( () => {
    this.resize();
  }, 100);
};

/**
 * Check if a node or one of its parents has a particular tag name.
 *
 * @param {HTMLElement} node Node to check.
 * @param {string|string[]} tagNames Tag name(s).
 * @param {HTMLElement} [stop] Optional node to stop. Defaults to body node.
 * @return {boolean} True, if node belongs to a node with one of the tag names.
 */
BookMaker.prototype.belongsToTagName = function (node, tagNames, stop) {
  if (!node) {
    return false;
  }

  // Stop check at DOM tree root
  stop = stop || document.body;

  if (typeof tagNames === 'string') {
    tagNames = [tagNames];
  }
  tagNames = tagNames.map(tagName => tagName.toLowerCase());

  const tagName = node.tagName.toLowerCase();
  if (tagNames.indexOf(tagName) !== -1) {
    return true;
  }

  // Having stop can prevent always parsing DOM tree to root
  if (stop === node) {
    return false;
  }

  return this.belongsToTagName(node.parentNode, tagNames, stop);
};

/**
 * Check if a node or one of its parents has a non-negative tabIndex
 *
 * @param {HTMLElement} node Node to check.
 * @param {HTMLElement} [stop] Optional node to stop. Defaults to body node.
 * @return {boolean} True, if node belongs to a node with tabIndex > -1.
 */
BookMaker.prototype.belongsToTabIndexed = function (node, stop) {
  if (!node) {
    return false;
  }

  // Stop check at DOM tree root
  stop = stop || document.body;

  if (node.tabIndex !== -1) {
    return true;
  }

  // Having stop can prevent always parsing DOM tree to root
  if (stop === node) {
    return false;
  }

  return this.belongsToTabIndexed(node.parentNode, stop);
};

/**
 * Returns the scene title, or "No title" if inside editor without title
 *
 * @return {string|null}
 */
BookMaker.prototype.createSceneTitle = function () {
  return this.isEditor() ? this.l10n.noTitle : null;
};

/**
 * Returns true if inside the editor
 *
 * @return {boolean}
 */
BookMaker.prototype.isEditor = function () {
  return this.editor !== undefined;
};

/**
 * Create navigation bars.
 */
BookMaker.prototype.createNavigationBars = function () {
  // Left navigation bar
  this.navigationLeft = new NavigationBar({
    label: this.l10n.prevScene,
    position: 'left',
    prefix: 'h5p-book-maker'
  }, {
    onClick: () => {
      if (this.currentSceneIndex === 0) {
        return;
      }
      this.previousScene();
    }
  });
  this.$wrapper.append(this.navigationLeft.getDOM());

  // Right navigation bar
  this.navigationRight = new NavigationBar({
    label: this.l10n.nextScene,
    position: 'right',
    prefix: 'h5p-book-maker'
  }, {
    onClick: () => {
      if (this.currentSceneIndex + 1 >= this.children.length) {
        return;
      }

      this.nextScene();
    }
  });
  this.navigationRight.show();
  this.$wrapper.append(this.navigationRight.getDOM());
};

/**
 * Create fullscreen button.
 */
BookMaker.prototype.createFullScreenButton = function () {
  if (H5P.fullscreenSupported !== true) {
    return;
  }

  const container = document.querySelector('.h5p-container');

  const toggleFullScreen = (event) => {
    if (event && event.type === 'keypress' && event.keyCode !== 13 && event.keyCode !== 32) {
      return;
    }
    else {
      event.preventDefault();
    }

    if (H5P.isFullscreen === true) {
      H5P.exitFullScreen();
    }
    else {
      H5P.fullScreen(H5P.jQuery(container), this);
    }
  };

  this.fullScreenButton = document.createElement('button');
  this.fullScreenButton.classList.add('h5p-book-maker-fullscreen-button');
  this.fullScreenButton.setAttribute('aria-label', this.l10n.fullscreen);
  this.fullScreenButton.addEventListener('click', toggleFullScreen);

  this.on('enterFullScreen', () => {
    this.fullScreenButton.setAttribute('aria-label', this.l10n.exitFullscreen);
  });

  this.on('exitFullScreen', () => {
    this.fullScreenButton.setAttribute('aria-label', this.l10n.fullscreen);
  });

  const fullScreenButtonWrapper = document.createElement('div');
  fullScreenButtonWrapper.classList.add('h5p-book-maker-fullscreen-button-wrapper');
  fullScreenButtonWrapper.appendChild(this.fullScreenButton);

  container.insertBefore(fullScreenButtonWrapper, container.firstChild);
};

/**
 * Create scenes
 * Scenes are directly attached to the scenes wrapper.
 */
BookMaker.prototype.createScenes = function () {
  var self = this;
  for (let i = 0; i < self.children.length; i++) {
    const isCurrentScene = (i === self.currentSceneIndex);

    // Create and append DOM Elements
    self.children[i].getElement().appendTo(self.$scenesWrapper);

    if (isCurrentScene) {
      self.children[i].setCurrent();
    }

    if (self.isEditor() || i === 0 || i === 1 || isCurrentScene) {
      self.children[i].appendElements();
    }
  }
};

/**
 * Return the combined score of all children
 *
 * @public
 * @returns {Number}
 */
BookMaker.prototype.getScore = function () {
  return 0;
};

/**
 * Return the combined maxScore of all children
 *
 * @public
 * @returns {Number}
 */
BookMaker.prototype.getMaxScore = function () {
  return 0;
};

/**
 * Resize handling.
 *
 * @param {Boolean} fullscreen
 * @returns {undefined}
 */
BookMaker.prototype.resize = function () {
  var fullscreenOn = this.$container.hasClass('h5p-fullscreen') || this.$container.hasClass('h5p-semi-fullscreen');

  if (this.ignoreResize) {
    return; // When printing.
  }

  // Fill up all available width
  this.$wrapper.css('width', 'auto');
  var width = this.$container.width();
  var style = {};

  if (fullscreenOn) {
    var maxHeight = this.$container.height();
    if (width / maxHeight > this.ratio) {
      // Top and bottom would be cut off so scale down.
      width = maxHeight * this.ratio;
      style.width = width + 'px';
    }
  }

  // TODO: Add support for -16 when content conversion script is created?
  var widthRatio = width / this.width;
  style.height = (width / this.ratio) + 'px';
  style.fontSize = (this.fontSize * widthRatio) + 'px';

  if (this.editor !== undefined) {
    this.editor.setContainerEm(this.fontSize * widthRatio * 0.75);
  }

  this.$wrapper.css(style);

  this.swipeThreshold = widthRatio * 100; // Default swipe threshold is 50px.

  // Resize elements
  var instances = this.elementInstances[this.$current.index()];
  if (instances !== undefined) {
    for (var i = 0; i < instances.length; i++) {
      var instance = instances[i];
      if ((instance.preventResize === undefined || instance.preventResize === false) && instance.$ !== undefined) {
        H5P.trigger(instance, 'resize');
      }
    }
  }
};

/**
 * Enter/exit full screen mode.
 */
BookMaker.prototype.toggleFullScreen = function () {
  if (H5P.isFullscreen || this.$container.hasClass('h5p-fullscreen') || this.$container.hasClass('h5p-semi-fullscreen')) {
    // Cancel fullscreen
    if (H5P.exitFullScreen !== undefined && H5P.fullScreenBrowserPrefix !== undefined) {
      H5P.exitFullScreen();
    }
    else {
      // Use old system
      if (H5P.fullScreenBrowserPrefix === undefined) {
        // Click button to disable fullscreen
        H5P.jQuery('.h5p-disable-fullscreen').click();
      }
      else {
        if (H5P.fullScreenBrowserPrefix === '') {
          window.top.document.exitFullScreen();
        }
        else if (H5P.fullScreenBrowserPrefix === 'ms') {
          window.top.document.msExitFullscreen();
        }
        else {
          window.top.document[H5P.fullScreenBrowserPrefix + 'CancelFullScreen']();
        }
      }
    }
  }
  else {
    // Rescale footer buttons
    this.$footer.addClass('footer-full-screen');

    this.$fullScreenButton.attr('title', this.l10n.exitFullscreen);
    H5P.fullScreen(this.$container, this);
    if (H5P.fullScreenBrowserPrefix === undefined) {
      // Hide disable full screen button. We have our own!
      H5P.jQuery('.h5p-disable-fullscreen').hide();
    }
  }
};

/**
 * Set focus.
 */
BookMaker.prototype.focus = function () {
  this.$wrapper.focus();
};

/**
 * Set the default behaviour override for all actions.
 *
 * @param {Object} override
 */
BookMaker.prototype.setElementsOverride = function (override) {
  // Create default object
  this.elementsOverride = {
    params: {}
  };

  if (override) {
    // Create behaviour object for overriding
    this.elementsOverride.params.behaviour = {};

    if (override.retryButton) {
      // Override retry button
      this.elementsOverride.params.behaviour.enableRetry =
          (override.retryButton === 'on' ? true : false);
    }
  }
};

/**
 * Attach all element instances to scene.
 *
 * @param {jQuery} $scene
 * @param {Number} index
 */
BookMaker.prototype.attachElements = function ($scene, index) {
  if (this.elementsAttached[index] !== undefined) {
    return; // Already attached
  }

  var scene = this.scenes[index];
  var instances = this.elementInstances[index];
  if (scene.elements !== undefined) {
    for (var i = 0; i < scene.elements.length; i++) {
      this.attachElement(scene.elements[i], instances[i], $scene, index);
    }
  }
  this.trigger('domChanged', {
    '$target': $scene,
    'library': 'BookMaker',
    'key': 'newScene'
  }, {'bubbles': true, 'external': true});

  this.elementsAttached[index] = true;
};

/**
 * Attach element to scene container.
 *
 * @param {Object} element
 * @param {Object} instance
 * @param {jQuery} $scene
 * @param {Number} index
 * @returns {jQuery}
 */
BookMaker.prototype.attachElement = function (element, instance, $scene, index) {
  const displayAsButton = (element.displayAsButton !== undefined && element.displayAsButton);

  // Only using the button style from Course Presentation for Audio Recorder
  var classes = 'h5p-element' + (displayAsButton ? ' h5p-element-button-wrapper h5p-element-button-big' : '');
  var $elementContainer = H5P.jQuery('<div>', {
    'class': classes,
  }).css({
    left: element.x + '%',
    top: element.y + '%',
    width: element.width + '%',
    height: element.height + '%'
  }).appendTo($scene);

  const isTransparent = element.backgroundOpacity === undefined || element.backgroundOpacity === 0;
  $elementContainer.toggleClass('h5p-transparent', isTransparent);

  if (displayAsButton) {
    const $button = this.createInteractionButton(element, instance);
    $button.appendTo($elementContainer);
  }
  else {
    const hasLibrary = element.action && element.action.library;
    const libTypePmz = hasLibrary ? this.getLibraryTypePmz(element.action.library) : 'other';

    var $outerElementContainer = H5P.jQuery('<div>', {
      'class': `h5p-element-outer ${libTypePmz}-outer-element`
    }).css({
      background: 'rgba(255,255,255,' + (element.backgroundOpacity === undefined ? 0 : element.backgroundOpacity / 100) + ')'
    }).appendTo($elementContainer);

    var $innerElementContainer = H5P.jQuery('<div>', {
      'class': 'h5p-element-inner'
    }).appendTo($outerElementContainer);

    // H5P.Shape sets it's own size when line in selected
    instance.on('set-size', function (event) {
      for (let property in event.data) {
        $elementContainer.get(0).style[property] = event.data[property];
      }
    });

    instance.attach($innerElementContainer);

    // For first scene
    this.setOverflowTabIndex();
  }

  if (this.editor !== undefined) {
    // If we're in the H5P editor, allow it to manipulate the elementInstances
    this.editor.processElement(element, $elementContainer, index, instance);
  }

  // Add custom images to audio button
  if (element.action && element.action.library && element.action.library.split(' ')[0] === 'H5P.Audio') {
    const audioButton = $innerElementContainer.get(0).querySelector('button');
    if (audioButton) {
      if (element.customImagePlay && element.customImagePlay.path) {
        audioButton.classList.add('h5p-book-maker-custom-audio-button');

        const customImage = document.createElement('img');
        customImage.classList.add('h5p-book-maker-custom-audio-button-image');
        customImage.classList.add('h5p-book-maker-selection-not-allowed');
        customImage.setAttribute('draggable', false);
        H5P.setSource(customImage, element.customImagePlay, this.contentId);
        audioButton.appendChild(customImage);

        // Audio has ended
        instance.audio.addEventListener('ended', () => {
          H5P.setSource(customImage, element.customImagePlay, this.contentId);
        });

        // Audio was paused
        if (element.customImagePlayPaused && element.customImagePlayPaused.path) {
          instance.audio.addEventListener('pause', () => {
            H5P.setSource(customImage, element.customImagePlayPaused, this.contentId);
          });
        }

        // Audio was continued
        if (element.customImagePause && element.customImagePause.path) {
          instance.audio.addEventListener('play', () => {
            H5P.setSource(customImage, element.customImagePause, this.contentId);
          });
        }
      }
    }
  }

  // Check if element is allowed to be moved
  if (!this.editor && element.action && element.action.library && element.action.library.split(' ')[0] === 'H5P.Image') {
    const elementContainer = $elementContainer.get(0);
    elementContainer.classList.add('h5p-book-maker-selection-not-allowed');

    if (element.canBeMovedByUser) {
      elementContainer.classList.add('h5p-book-maker-draggable-element');
      this.addElementMoveListeners(elementContainer, element.audio);
    }
    else {
      const image = elementContainer.querySelector('img');
      if (image) {
        image.setAttribute('draggable', false);
      }
    }
  }

  // Check if text is allowed to be changed
  if (!this.editor && element.action && element.action.library && element.action.library.split(' ')[0] === 'H5P.AdvancedText') {
    if (element.canBeChangedByUser) {
      const textInputElement = $elementContainer.get(0);
      textInputElement.classList.add('h5p-book-maker-no-overflow');
      textInputElement.setAttribute('contenteditable', 'true');
      textInputElement.setAttribute('role', 'input');

      textInputElement.addEventListener('click', (event) => {
        const foo = document.querySelector('.h5p-content');
        if (foo) {
          foo.classList.remove('using-mouse');
        }
        event.currentTarget.focus();
      });
    }
  }

  return $elementContainer;
};

/**
 * Add move listeners to DOM element of instance.
 * @param {HTMLElement} dragItem Item to be dragged.
 * @param {object} [audios={}] Audios.
 * @param {object[]} [audios.pickedUp] Audio to play when picked up.
 * @param {object[]} [audios.droped] Audio to play when dropped.
 */
BookMaker.prototype.addElementMoveListeners = function (dragItem, audios = {}) {
  const container = dragItem.parentNode;
  const players = {};

  let active = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  ['pickedUp', 'dropped'].forEach(type => {
    if (
      !audios[type] ||
      !Array.isArray(audios[type]) ||
      audios[type].length < 1 ||
      !audios[type][0].path ||
      audios[type][0].mime.split('/')[0] !== 'audio'
    ) {
      return;
    }

    // Attach audio elements
    const player = document.createElement('audio');
    player.classList.add('h5p-dragquestion-no-display');
    player.src = H5P.getPath(audios[type][0].path, this.contentId);
    container.appendChild(player);

    // Track audio elements
    this.players.push(player);
    players[type] = player;
  });

  // Handle element move start
  const handleElementMoveStart = (event) => {
    // Hide navigation bars
    if (!this.isEditor()) {
      this.navigationLeft.hide();
      this.navigationRight.hide();
    }

    if (event.type === 'touchstart') {
      initialX = event.touches[0].clientX - xOffset;
      initialY = event.touches[0].clientY - yOffset;
    }
    else {
      initialX = event.clientX - xOffset;
      initialY = event.clientY - yOffset;
    }

    const ancestor = checkAncestor(event.target, dragItem);
    if (ancestor) {
      // Move selected draggable element to top
      const draggables = document.querySelector('.h5p-scene.h5p-current').querySelectorAll('.h5p-book-maker-draggable-element');
      for (let i = 0; i < draggables.length; i++) {
        draggables[i].classList.remove('h5p-book-maker-draggable-element-top');
      }
      ancestor.classList.add('h5p-book-maker-draggable-element-top');
      ancestor.classList.add('h5p-book-maker-draggable-element-grabbing');

      active = true;

      if (players.pickedUp) {
        this.resetAudios();
        this.playAudio(players.pickedUp);
      }
    }
  };

  // Handle element move
  const handleElementMove = (event) => {
    if (active) {
      event.preventDefault();

      if (event.type === 'touchmove') {
        currentX = event.touches[0].clientX - initialX;
        currentY = event.touches[0].clientY - initialY;
      }
      else {
        currentX = event.clientX - initialX;
        currentY = event.clientY - initialY;
      }

      xOffset = currentX;
      yOffset = currentY;

      dragItem.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
    }
  };

  // Handle element move end
  const handleElementMoveEnd = (event) => {
    // Show navigation bars
    if (!this.isEditor()) {
      if (this.currentSceneIndex > 0) {
        this.navigationLeft.show();
      }
      if (this.currentSceneIndex < this.children.length - 1) {
        this.navigationRight.show();
      }
    }

    initialX = currentX;
    initialY = currentY;

    const ancestor = checkAncestor(event.target, dragItem);
    if (ancestor) {
      ancestor.classList.remove('h5p-book-maker-draggable-element-grabbing');

      if (players.dropped) {
        this.resetAudios();
        this.playAudio(players.dropped);
      }
    }

    active = false;
  };

  container.addEventListener('touchstart', handleElementMoveStart, false);
  container.addEventListener('touchmove', handleElementMove, false);
  container.addEventListener('touchend', handleElementMoveEnd, false);

  container.addEventListener('mousedown', handleElementMoveStart, false);
  container.addEventListener('mousemove', handleElementMove, false);
  container.addEventListener('mouseup', handleElementMoveEnd, false);
};

/**
 * Disables tab indexes behind a popup container
 */
BookMaker.prototype.disableTabIndexes = function () {
  var $popupContainer = this.$container.find('.h5p-popup-container');

  this.$tabbables = this.$container.find('a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, *[tabindex], *[contenteditable]').filter(function () {
    var $tabbable = $(this);
    var insideContainer = $.contains($popupContainer.get(0), $tabbable.get(0));

    // tabIndex has already been modified, keep it in the set.
    if ($tabbable.data('tabindex')) {
      return true;
    }

    if (!insideContainer) {
      // Store current tabindex, so we can set it back when dialog closes
      var tabIndex = $tabbable.attr('tabindex');
      $tabbable.data('tabindex', tabIndex);

      // Make it non tabbable
      $tabbable.attr('tabindex', '-1');
      return true;
    }

    // If element is part of dialog wrapper, just ignore it
    return false;
  });
};


/**
 * Re-enables tab indexes after a popup container is closed
 */
BookMaker.prototype.restoreTabIndexes = function () {
  if (this.$tabbables) {
    this.$tabbables.each(function () {
      var $element = $(this);
      var tabindex = $element.data('tabindex');

      // Specifically handle jquery ui slider, since it overwrites data in an inconsistent way
      if ($element.hasClass('ui-scener-handle')) {
        $element.attr('tabindex', 0);
        $element.removeData('tabindex');
      }
      else if (tabindex !== undefined) {
        $element.attr('tabindex', tabindex);
        $element.removeData('tabindex');
      }
      else {
        $element.removeAttr('tabindex');
      }
    });
  }
};

/**
 * Creates the interaction button
 *
 * @param {Object} element
 * @param {Object} instance
 *
 * @return {jQuery}
 */
BookMaker.prototype.createInteractionButton = function (element, instance) {
  const autoPlay = element.action.params && element.action.params.bookMakerAutoplay;
  let label = element.action.metadata ? element.action.metadata.title : '';
  if (label === '') {
    label = (element.action.params && element.action.params.contentName) || element.action.library.split(' ')[0].split('.')[1];
  }
  const libTypePmz = this.getLibraryTypePmz(element.action.library);

  /**
   * Returns a function that will set [aria-expanded="false"] on the $btn element
   *
   * @param {jQuery} $btn
   * @return {Function}
   */
  const setAriaExpandedFalse = $btn => () => $btn.attr('aria-expanded', 'false');

  const $button = $('<div>', {
    role: 'button',
    tabindex: 0,
    'aria-label': label,
    'aria-popup': true,
    'aria-expanded': false,
    'class': `h5p-element-button ${libTypePmz}-button`
  });

  const $buttonElement = $('<div class="h5p-button-element"></div>');
  instance.attach($buttonElement);

  const parentPosition = libTypePmz === 'h5p-advancedtext' ? {
    x: element.x,
    y: element.y
  } : null;
  addClickAndKeyboardListeners($button, () => {
    $button.attr('aria-expanded', 'true');
    this.showInteractionPopup(instance, $button, $buttonElement, libTypePmz, autoPlay, setAriaExpandedFalse($button), parentPosition);
    this.disableTabIndexes(); // Disable tabs behind overlay
  });

  if (element.action !== undefined && element.action.library.substr(0, 20) === 'H5P.InteractiveVideo') {
    instance.on('controls', function () {
      if (instance.controls.$fullscreen) {
        instance.controls.$fullscreen.remove();
      }
    });
  }

  return $button;
};

/**
 * Shows the interaction popup on button press
 *
 * @param {object} instance
 * @param {string} libTypePmz
 * @param {boolean} autoPlay
 * @param {function} closeCallback
 * @param {Object} [popupPosition] X and Y position of popup
 */
BookMaker.prototype.showInteractionPopup = function (instance, $button, $buttonElement, libTypePmz, autoPlay, closeCallback, popupPosition = null) {

  // Handle exit fullscreen
  const exitFullScreen = () => {
    instance.trigger('resize');
  };

  if (!this.isEditor()) {
    // Listen for exit fullscreens not triggered by button, for instance using 'esc'
    this.on('exitFullScreen', exitFullScreen);

    this.showPopup($buttonElement, $button, popupPosition, () => {
      this.pauseMedia(instance);
      $buttonElement.detach();

      // Remove listener, we only need it for active popups
      this.off('exitFullScreen', exitFullScreen);
      closeCallback();
    }, libTypePmz);

    H5P.trigger(instance, 'resize');

    // Resize images to fit popup dialog
    if (libTypePmz === 'h5p-image') {
      this.resizePopupImage($buttonElement);
    }

    // Focus directly on content when popup is opened
    setTimeout(() => {
      var $tabbables = $buttonElement.find(':input').add($buttonElement.find('[tabindex]'));
      if ($tabbables.length) {
        $tabbables[0].focus();
      }
      else {
        $buttonElement.attr('tabindex', 0);
        $buttonElement.focus();
      }
    }, 200);

    // start activity
    if (isFunction(instance.setActivityStarted) && isFunction(instance.getScore)) {
      instance.setActivityStarted();
    }

    // Autoplay media
    if (autoPlay && isFunction(instance.play)) {
      instance.play();
    }
  }
};

/**
 * Returns the name part of a library string
 *
 * @param {string} library
 * @return {string}
 */
BookMaker.prototype.getLibraryTypePmz = library => kebabCase(library.split(' ')[0]).toLowerCase();

/**
 * Resize image inside popup dialog.
 *
 * @public
 * @param {H5P.jQuery} $wrapper
 */
BookMaker.prototype.resizePopupImage = function ($wrapper) {
  // Get fontsize, needed for scale
  var fontSize = Number($wrapper.css('fontSize').replace('px', ''));
  var $img = $wrapper.find('img');

  /**
   * Resize image to fit inside popup.
   *
   * @private
   * @param {Number} width
   * @param {Number} height
   */
  var resize = function (width, height) {
    if ((height / fontSize) < 18.5) {
      return;
    }

    var ratio = (width / height);
    height = 18.5 * fontSize;
    $wrapper.css({
      width: height * ratio,
      height: height
    });
  };

  if (!$img.height()) {
    // Wait for image to load
    $img.one('load', function () {
      resize(this.width, this.height);
    });
  }
  else {
    // Image already loaded, resize!
    resize($img.width(), $img.height());
  }
};

/**
 * Displays a popup.
 *
 * @param {string|jQuery} popupContent
 * @param {jQuery} $focusOnClose Prevents losing focus when dialog closes
 * @param {object} [parentPosition] x and y coordinates of parent
 * @param {Function} [remove] Gets called before the popup is removed.
 * @param {string} [classes]
 */
BookMaker.prototype.showPopup = function (popupContent, $focusOnClose, parentPosition = null, remove, classes = 'h5p-popup-comment-field') {
  var self = this;
  var doNotClose;

  /** @private */
  var close = function (event) {
    if (doNotClose) {
      // Prevent closing the popup
      doNotClose = false;
      return;
    }

    // Remove popup
    if (remove !== undefined) {
      setTimeout(function () {
        remove();
        self.restoreTabIndexes();
      }, 100);
    }
    event.preventDefault();
    $popup.addClass('h5p-animate');
    $popup.find('.h5p-popup-container').addClass('h5p-animate');

    setTimeout(function () {
      $popup.remove();
    }, 100);

    $focusOnClose.focus();
  };

  const $popup = $(
    '<div class="h5p-popup-overlay ' + classes + '">' +
      '<div class="h5p-popup-container" role="dialog">' +
        '<div class="h5p-book-maker-dialog-titlebar">' +
          '<div class="h5p-dialog-title"></div>' +
          '<div role="button" tabindex="0" class="h5p-close-popup" title="' + this.l10n.close + '"></div>' +
        '</div>' +
        '<div class="h5p-popup-wrapper" role="document"></div>' +
      '</div>' +
    '</div>');

  const $popupWrapper = $popup.find('.h5p-popup-wrapper');
  if (popupContent instanceof H5P.jQuery) {
    $popupWrapper.append(popupContent);
  }
  else {
    $popupWrapper.html(popupContent);
  }

  const $popupContainer = $popup.find('.h5p-popup-container');

  const resizePopup = ($popup, $popupContainer, parentPosition) => {
    if (!parentPosition) {
      return;
    }

    // Do not show until we have finished calculating position
    $popupContainer.css({ visibility: 'hidden' });
    $popup.prependTo(this.$wrapper);

    let popupHeight = $popupContainer.height();
    let popupWidth = $popupContainer.width();
    const overlayHeight = $popup.height();
    const overlayWidth = $popup.width();
    let widthPercentage = popupWidth * (100 / overlayWidth);
    let heightPercentage = popupHeight * (100 / overlayHeight);

    // Skip sufficiently big popups
    const skipThreshold = 50;
    if (widthPercentage > skipThreshold && heightPercentage > skipThreshold) {
      $popup.detach();
      return;
    }

    // Only resize boxes that are disproportionally wide
    const heightThreshold = 45;
    if (widthPercentage > heightPercentage && heightPercentage < heightThreshold) {
      // Make the popup quadratic
      widthPercentage = Math.sqrt(widthPercentage * heightPercentage);
      $popupContainer.css({
        width: widthPercentage + '%',
      });
    }

    // Account for overflowing edges
    const widthPadding = 15 / 2;
    const leftPosThreshold = 100 - widthPercentage - widthPadding;
    let leftPos = parentPosition.x;
    if (parentPosition.x > leftPosThreshold) {
      leftPos = leftPosThreshold;
    }
    else if (parentPosition.x < widthPadding) {
      leftPos = widthPadding;
    }

    heightPercentage = $popupContainer.height() * (100 / overlayHeight);
    const heightPadding = 20 / 2;
    const topPosThreshold = 100 - heightPercentage - heightPadding;
    let topPos = parentPosition.y;
    if (parentPosition.y > topPosThreshold) {
      topPos = topPosThreshold;
    }
    else if (parentPosition.y < heightPadding) {
      topPos = heightPadding;
    }

    // Reset and prepare to animate in
    $popup.detach();
    $popupContainer.css({
      left: leftPos + '%',
      top: topPos + '%',
    });
  };

  resizePopup($popup, $popupContainer, parentPosition);
  $popup.addClass('h5p-animate');
  $popupContainer.css({
    'visibility': '',
  }).addClass('h5p-animate');

  // Insert popup ready for use
  $popup
    .prependTo(this.$wrapper)
    .focus()
    .removeClass('h5p-animate')
    .click(close)
    .find('.h5p-popup-container')
    .removeClass('h5p-animate')
    .click(function () {
      doNotClose = true;
    })
    .keydown(function (event) {
      if (event.which === keyCode.ESC) {
        close(event);
      }
    })
    .end();

  addClickAndKeyboardListeners($popup.find('.h5p-close-popup'), event => close(event));

  return $popup;
};


/**
 * Initialize key press events.
 *
 * @returns {undefined} Nothing.
 */
BookMaker.prototype.initKeyEvents = function () {
  if (this.keydown !== undefined) {
    return;
  }

  var that = this;
  var wait = false;

  this.keydown = function (event) {
    if (wait) {
      return;
    }

    // Left
    if ((event.keyCode === 37 || event.keyCode === 33) && that.previousScene()) {
      event.preventDefault();
      wait = true;
    }

    // Right
    else if ((event.keyCode === 39 || event.keyCode === 34) && that.nextScene()) {
      event.preventDefault();
      wait = true;
    }

    if (wait) {
      // Make sure we only change scene every 300ms.
      setTimeout(function () {
        wait = false;
      }, 300);
    }
  };

  H5P.jQuery('body').keydown(this.keydown);
};

/**
 * Initialize touch events
 *
 * @returns {undefined} Nothing.
 */
BookMaker.prototype.initTouchEvents = function () {
  var that = this;
  var startX, startY, lastX, prevX, nextX, scroll;
  var touchStarted = false;
  var isTouchJump = false;
  var transform = function (value) {
    return {
      '-webkit-transform': value,
      '-moz-transform': value,
      '-ms-transform': value,
      'transform': value
    };
  };
  var reset = transform('');

  this.$scenesWrapper.bind('touchstart', function (event) {
    // Hide navigation bars when on touch
    if (!this.isEditor()) {
      this.navigationLeft.hide();
      this.navigationRight.hide();
    }

    if (isDraggable(event.target)) {
      return; // moving element, not scene
    }

    isTouchJump = false;
    // Set start positions
    lastX = startX = event.originalEvent.touches[0].pageX;
    startY = event.originalEvent.touches[0].pageY;
    const sceneWidth = that.$scenesWrapper.width();

    // Set classes for scene movement and remember how much they move
    prevX = (that.currentSceneIndex === 0 ? 0 : - sceneWidth);
    nextX = (that.currentSceneIndex + 1 >= that.scenes.length ? 0 : sceneWidth);

    scroll = null;
    touchStarted = true;

  }).bind('touchmove', function (event) {
    if (isDraggable(event.target)) {
      return; // moving element, not scene
    }

    var touches = event.originalEvent.touches;

    if (touchStarted) {
      that.$current.prev().addClass('h5p-touch-move');
      that.$current.next().addClass('h5p-touch-move');
      touchStarted = false;
    }

    // Determine horizontal movement
    lastX = touches[0].pageX;
    var movedX = startX - lastX;

    if (scroll === null) {
      // Detemine if we're scrolling horizontally or changing scene
      scroll = Math.abs(startY - event.originalEvent.touches[0].pageY) > Math.abs(movedX);
    }
    if (touches.length !== 1 || scroll) {
      // Do nothing if we're scrolling, zooming etc.
      return;
    }

    // Disable horizontal scrolling when changing scene
    event.preventDefault();

    // Create popup longer time than navigateTimer has passed
    if (!isTouchJump) {

      // Fast swipe to next scene
      if (movedX < 0) {
        // Move previous scene
        that.$current.prev().css(transform('translateX(' + (prevX - movedX) + 'px'));
      }
      else {
        // Move next scene
        that.$current.next().css(transform('translateX(' + (nextX - movedX) + 'px)'));
      }

      // Move current scene
      that.$current.css(transform('translateX(' + (-movedX) + 'px)'));
    }
    // TODO: Jumping over multiple scenes disabled until redesigned.

  }).bind('touchend', function () {
    if (!scroll) {

      // If we're not scrolling detemine if we're changing scene
      var moved = startX - lastX;
      if (moved > that.swipeThreshold && that.nextScene() || moved < -that.swipeThreshold && that.previousScene()) {
        return;
      }
    }
    // Reset.
    that.$scenesWrapper.children().css(reset).removeClass('h5p-touch-move');
  });
};

/**
 *
 * @param $container
 * @param sceneNumber
 * @param xPos
 * @param yPos
 */
BookMaker.prototype.updateTouchPopup = function ($container, sceneNumber, xPos, yPos) {
  // Remove popup on no arguments
  if (arguments.length <= 0) {
    if (this.touchPopup !== undefined) {
      this.touchPopup.remove();
    }
    return;
  }

  var yPosAdjustment = 0.15; // Adjust y-position 15% higher for visibility

  if (this.touchPopup === undefined) {
    this.touchPopup = H5P.jQuery('<div/>', {
      'class': 'h5p-touch-popup'
    }).insertAfter($container);
  }
  else {
    this.touchPopup.insertAfter($container);
  }

  // Adjust yPos above finger.
  if ((yPos - ($container.parent().height() * yPosAdjustment)) < 0) {
    yPos = 0;
  }
  else {
    yPos -= ($container.parent().height() * yPosAdjustment);
  }

  this.touchPopup.css({
    'max-width': $container.width() - xPos,
    'left': xPos,
    'top': yPos
  });
  this.touchPopup.html();
};

/**
 * Switch to previous scene
 *
 * @param {Boolean} [noScroll] Skip UI scrolling.
 * @returns {Boolean} Indicates if the move was made.
 */
BookMaker.prototype.previousScene = function (noScroll) {
  var $prev = this.$current.prev();
  if (!$prev.length) {
    return false;
  }

  return this.jumpToScene($prev.index(), noScroll, false);
};

/**
 * Switch to next scene.
 *
 * @param {Boolean} noScroll Skip UI scrolling.
 * @returns {Boolean} Indicates if the move was made.
 */
BookMaker.prototype.nextScene = function (noScroll) {
  var $next = this.$current.next();
  if (!$next.length) {
    return false;
  }

  return this.jumpToScene($next.index(), noScroll, false);
};

/**
 * Returns true when the element is the current scene
 *
 * @param {number} index
 * @return {boolean}
 */
BookMaker.prototype.isCurrentScene = function (index) {
  return this.currentSceneIndex === index;
};

/**
 * Returns the current scene index
 *
 * @return {number}
 */
BookMaker.prototype.getCurrentSceneIndex = function () {
  return this.currentSceneIndex;
};

/**
 * Loads all scenes (Needed by print)
 * @method attachAllElements
 */
BookMaker.prototype.attachAllElements = function () {
  var $scenes = this.$scenesWrapper.children();

  for (let i = 0; i < this.scenes.length; i++) {
    this.attachElements($scenes.eq(i), i);
  }
};

/**
 * Jump to the given scene.
 *
 * @param {number} sceneNumber The scene number to jump to.
 * @param {Boolean} [noScroll] Skip UI scrolling.
 * @returns {Boolean} Always true.
 */
BookMaker.prototype.jumpToScene = function (sceneNumber, noScroll, handleFocus = false) {
  var that = this;
  if (this.editor === undefined && this.contentId) { // Content ID avoids crash when previewing in editor before saving
    var progressedEvent = this.createXAPIEventTemplate('progressed');
    progressedEvent.data.statement.object.definition.extensions['http://id.tincanapi.com/extension/ending-point'] = sceneNumber + 1;
    this.trigger(progressedEvent);
  }

  if (this.$current.hasClass('h5p-animate')) {
    return;
  }

  // Jump to given scene and enable animation.
  var $old = this.$current.addClass('h5p-animate');
  var $scenes = that.$scenesWrapper.children();
  var $prevs = $scenes.filter(':lt(' + sceneNumber + ')');
  this.$current = $scenes.eq(sceneNumber).addClass('h5p-animate');
  var previousSceneIndex = this.currentSceneIndex;
  this.currentSceneIndex = sceneNumber;

  // Update navigation bars
  if (!this.isEditor()) {
    if (sceneNumber === 0) {
      this.navigationLeft.hide();
      this.navigationRight.show();
    }
    else if (sceneNumber === $scenes.length - 1) {
      this.navigationLeft.show();
      this.navigationRight.hide();
    }
    else {
      this.navigationLeft.show();
      this.navigationRight.show();
    }
  }

  // Attach elements for this scene
  this.attachElements(this.$current, sceneNumber);

  // Attach elements for next scene
  var $nextScene = this.$current.next();
  if ($nextScene.length) {
    this.attachElements($nextScene, sceneNumber + 1);
  }

  // For new scene
  this.setOverflowTabIndex();

  // Stop media on old scene
  // this is done no mather what autoplay says
  var instances = this.elementInstances[previousSceneIndex];
  if (instances !== undefined) {
    for (var i = 0; i < instances.length; i++) {
      this.pauseMedia(instances[i]);
    }
  }

  setTimeout(function () {
    // Play animations
    $old.removeClass('h5p-current');
    $scenes.css({
      '-webkit-transform': '',
      '-moz-transform': '',
      '-ms-transform': '',
      'transform': ''
    }).removeClass('h5p-touch-move').removeClass('h5p-previous');
    $prevs.addClass('h5p-previous');
    that.$current.addClass('h5p-current');
    that.trigger('changedScene', that.$current.index());
  }, 1);

  setTimeout(function () {
    // Done animating
    that.$scenesWrapper.children().removeClass('h5p-animate');

    if (that.editor !== undefined) {
      return;
    }

    // Start media on new scene for elements beeing setup with autoplay!
    var instances = that.elementInstances[that.currentSceneIndex];
    var instanceParams = that.scenes[that.currentSceneIndex].elements;
    if (instances !== undefined) {
      for (var i = 0; i < instances.length; i++) {
        // TODO: Check instance type instead to avoid accidents?
        if (instanceParams[i] &&
            instanceParams[i].action &&
            instanceParams[i].action.params &&
            instanceParams[i].action.params.bookMakerAutoplay &&
            typeof instances[i].play === 'function') {

          // Autoplay media if not button
          instances[i].play();
        }

        if (typeof instances[i].setActivityStarted === 'function' && typeof instances[i].getScore === 'function') {
          instances[i].setActivityStarted();
        }
      }
    }
  }, 250);

  if (that.navigationLine) {
    // Update progress bar
    that.navigationLine.updateProgressBar(sceneNumber, previousSceneIndex);

    // Update footer
    that.navigationLine.updateFooter(sceneNumber);

    // Announce scene change
    this.setSceneNumberAnnouncer(sceneNumber, handleFocus);
  }

  // Editor specific settings
  if (this.editor !== undefined && this.editor.dnb !== undefined) {
    // Update drag and drop menu bar container
    this.editor.dnb.setContainer(this.$current);
    this.editor.dnb.blurAll();
  }

  this.trigger('resize'); // Triggered to resize elements.

  return true;
};

/**
 * Set tab index for text containers that overflow with a scrollbar
 */
BookMaker.prototype.setOverflowTabIndex = function () {
  // On resume, this is not set yet, but it will be iovoked later
  if (this.$current === undefined) {
    return;
  }

  this.$current.find('.h5p-element-inner').each( function () {
    const $inner = $(this);

    // Currently, this rule is for tables only
    let innerHeight;
    if (this.classList.contains('h5p-table')) {
      innerHeight = $inner.find('.h5p-table').outerHeight();
    }

    // Add tabindex if there's an overflow (scrollbar depending on CSS)
    const outerHeight = $inner.closest('.h5p-element-outer').innerHeight();
    if (innerHeight !== undefined && outerHeight !== null && innerHeight > outerHeight) {
      $inner.attr('tabindex', 0);
    }
  });
};

/**
 * Set scene number so it can be announced to assistive technologies
 * @param {number} sceneNumber Index of scene that should have its' title announced
 * @param {boolean} [handleFocus=false] Moves focus to the top of the scene
 */
BookMaker.prototype.setSceneNumberAnnouncer = function (sceneNumber, handleFocus = false) {
  let sceneTitle = '';

  if (!this.navigationLine) {
    return sceneTitle;
  }

  sceneTitle += this.navigationLine.createSceneTitle(sceneNumber);
  this.$sceneAnnouncer.html(sceneTitle);
  if (handleFocus) {
    this.$sceneTop.focus();
  }
};

/**
 * Reset the content for all scenes.
 * @public
 */
BookMaker.prototype.resetTask = function () {
  this.navigationLine.updateProgressBar(0);
  this.jumpToScene(0, false);
  this.$container.find('.h5p-popup-overlay').remove();
};

/**
 * Gather copyright information for the current content.
 *
 * @returns {H5P.ContentCopyrights}
 */
BookMaker.prototype.getCopyrights = function () {
  var info = new H5P.ContentCopyrights();
  var elementCopyrights;

  // Check for a common background image shared by all scenes
  if (this.book && this.book.globalBackgroundSelector &&
      this.book.globalBackgroundSelector.imageGlobalBackground) {

    // Add image copyrights to the presentation scope
    var globalBackgroundImageParams = this.book.globalBackgroundSelector.imageGlobalBackground;
    var globalBackgroundImageCopyright = new H5P.MediaCopyright(globalBackgroundImageParams.copyright);
    globalBackgroundImageCopyright.setThumbnail(new H5P.Thumbnail(H5P.getPath(globalBackgroundImageParams.path, this.contentId), globalBackgroundImageParams.width, globalBackgroundImageParams.height));
    info.addMedia(globalBackgroundImageCopyright);
  }

  for (let sceneId = 0; sceneId < this.scenes.length; sceneId++) {
    var sceneInfo = new H5P.ContentCopyrights();
    sceneInfo.setLabel(this.l10n.scene + ' ' + (sceneId + 1));

    // Check for a scene specific background image
    if (this.scenes[sceneId] && this.scenes[sceneId].sceneBackgroundSelector &&
        this.scenes[sceneId].sceneBackgroundSelector.image) {

      // Add image copyrights to the scene scope
      var sceneBackgroundImageParams = this.scenes[sceneId].sceneBackgroundSelector.image;
      var sceneBackgroundImageCopyright = new H5P.MediaCopyright(sceneBackgroundImageParams.copyright);
      sceneBackgroundImageCopyright.setThumbnail(new H5P.Thumbnail(H5P.getPath(sceneBackgroundImageParams.path, this.contentId), sceneBackgroundImageParams.width, sceneBackgroundImageParams.height));
      sceneInfo.addMedia(sceneBackgroundImageCopyright);
    }

    // If scne has elements, add the ones with copyright info to this scene's copyright
    if (this.elementInstances[sceneId] !== undefined) {
      for (var element = 0; element < this.elementInstances[sceneId].length; element++) {
        var instance = this.elementInstances[sceneId][element];

        if (!this.scenes[sceneId].elements[element].action) {
          continue;
        }

        var params = this.scenes[sceneId].elements[element].action.params;
        var metadata = this.scenes[sceneId].elements[element].action.metadata;

        elementCopyrights = undefined;
        if (instance.getCopyrights !== undefined) {
          // Use the instance's own copyright generator
          elementCopyrights = instance.getCopyrights();
        }
        if (elementCopyrights === undefined) {
          // Create a generic flat copyright list
          elementCopyrights = new H5P.ContentCopyrights();
          // In metadata alone there's no way of knowing what the machineName is.
          H5P.findCopyrights(elementCopyrights, params, this.contentId, {metadata: metadata, machineName: instance.libraryInfo.machineName});
        }
        var label = (element + 1);
        if (params.contentName !== undefined) {
          label += ': ' + params.contentName;
        }
        else if (instance.getTitle !== undefined) {
          label += ': ' + instance.getTitle();
        }
        else if (params.l10n && params.l10n.name) {
          label += ': ' + params.l10n.name;
        }
        elementCopyrights.setLabel(label);

        sceneInfo.addContent(elementCopyrights);
      }
    }
    info.addContent(sceneInfo);
  }

  return info;
};

/**
 * Stop the given element's playback if any.
 *
 * @param {object} instance
 */
BookMaker.prototype.pauseMedia = function (instance) {
  try {
    if (instance.pause !== undefined &&
        (instance.pause instanceof Function ||
          typeof instance.pause === 'function')) {
      instance.pause();
    }
    else if (instance.video !== undefined &&
             instance.video.pause !== undefined &&
             (instance.video.pause instanceof Function ||
               typeof instance.video.pause === 'function')) {
      instance.video.pause();
    }
    else if (instance.stop !== undefined &&
             (instance.stop instanceof Function ||
               typeof instance.stop === 'function')) {
      instance.stop();
    }
  }
  catch (err) {
    // Prevent crashing, but tell developers there's something wrong.
    H5P.error(err);
  }
};

/**
 * Get xAPI data.
 * Contract used by report rendering engine.
 *
 * @see contract at {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
 */
BookMaker.prototype.getXAPIData = function () {
  var xAPIEvent = this.createXAPIEventTemplate('answered');

  // Extend definition
  var definition = xAPIEvent.getVerifiedStatementValue(['object', 'definition']);
  H5P.jQuery.extend(definition, {
    interactionType: 'compound',
    type: 'http://adlnet.gov/expapi/activities/cmi.interaction'
  });

  var score = this.getScore();
  var maxScore = this.getMaxScore();
  xAPIEvent.setScoredResult(score, maxScore, this, true, score === maxScore);

  return {
    statement: xAPIEvent.data.statement
  };
};

/**
 * Get scenes.
 * @return {Scene[]} Scenes.
 */
BookMaker.prototype.getChildren = function () {
  return this.children;
};

/**
 * Play audio sample.
 * @param {HTMLElement} audioElement Audio element to be played.
 */
BookMaker.prototype.playAudio = function (audioElement) {
  if (!this.$container.closest('.h5p-content').hasClass('using-mouse')) {
    return; // Don't disturb ARIA
  }

  if (!audioElement) {
    return;
  }

  audioElement.play();
};

/**
 * Reset audios.
 */
BookMaker.prototype.resetAudios = function () {
  this.players.forEach(player => {
    player.pause();
    player.load();
  });
};

export default BookMaker;
