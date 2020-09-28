/**
 * @class
 */
function Element(parameters) {
  const self = this;

  // H5P library
  var library;
  if (self.parent.parent.isEditor()) {
    // Clone the whole tree to avoid libraries accidentally changing params while running.
    library = H5P.jQuery.extend(true, {}, parameters.action, self.parent.parent.elementsOverride);
  }
  else {
    // Add defaults
    library = H5P.jQuery.extend(true, parameters.action, self.parent.parent.elementsOverride);
  }

  /* If library allows autoplay, control this from CP */
  if (library.params.autoplay) {
    library.params.autoplay = false;
    library.params.bookMakerAutoplay = true;
  }
  else if (library.params.playback && library.params.playback.autoplay) {
    library.params.playback.autoplay = false;
    library.params.bookMakerAutoplay = true;
  }
  else if (library.params.media &&
    library.params.media.params &&
    library.params.media.params.playback &&
    library.params.media.params.playback.autoplay) {
    // Control libraries that has content with autoplay through CP
    library.params.media.params.playback.autoplay = false;
    library.params.bookMakerAutoplay = true;
  }
  else if (library.params.media &&
    library.params.media.params &&
    library.params.media.params.autoplay) {
    // Control libraries that has content with autoplay through CP
    library.params.media.params.autoplay = false;
    library.params.bookMakerAutoplay = true;
  }
  else if (library.params.override &&
    library.params.override.autoplay) {
    // Control libraries that has content with autoplay through CP
    library.params.override.autoplay = false;
    library.params.bookMakerAutoplay = true;
  }

  var internalSceneId = self.parent.parent.elementInstances[self.parent.index] ? self.parent.parent.elementInstances[self.parent.index].length : 0;
  if (self.parent.parent.previousState && self.parent.parent.previousState.answers && self.parent.parent.previousState.answers[self.parent.index] && self.parent.parent.previousState.answers[self.parent.index][internalSceneId]) {
    // Restore previous state
    library.userDatas = {
      state: self.parent.parent.previousState.answers[self.parent.index][internalSceneId]
    };
  }

  // Override child settings
  library.params = library.params || {};
  self.instance = H5P.newRunnable(library, self.parent.parent.contentId, undefined, true, {parent: self.parent.parent});
  if (self.instance.preventResize !== undefined) {
    self.instance.preventResize = true;
  }

  if (self.parent.parent.elementInstances[self.parent.index] === undefined) {
    self.parent.parent.elementInstances[self.parent.index] = [self.instance];
  }
  else {
    self.parent.parent.elementInstances[self.parent.index].push(self.instance);
  }

  // Assumes that all audio recorder elements are at the end - they should :-)
  if (library.library.split(' ')[0] === 'H5P.Audio' && parameters.canBeChangedByUser) {
    self.parent.parent.audioReferences.push({
      instance: self.instance,
      id: self.parent.parent.audioReferences.length + 1
    });
  }

  if (library.library.split(' ')[0] === 'H5P.AudioRecorder') {
    const audioReference = self.parent.parent.audioReferences.shift();
    self.instance.bookmakerReferenceId = audioReference.id;

    self.instance.on('recordingdone', event => {
      if (event.data.id !== audioReference.id) {
        return; // Intended for other audio
      }

      audioReference.instance.audio.src = event.data.url;
      audioReference.instance.audio.load();

      // Close popup
      document.querySelector('.h5p-close-popup').click();
    });
  }
}

export default Element;
