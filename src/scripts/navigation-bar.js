/** Class representing a navigation bar */
export default class NavigationBar {
  /**
   * @constructor
   *
   * @param {object} params Parameters.
   * @param {object} callbacks, Callbacks.
   */
  constructor(params, callbacks = {}) {
    this.params = params || {};
    this.params.position = params.position || 'left';
    this.params.prefix = params.prefix || '';
    this.params.label = this.params.label || 'Move';

    this.callbacks = callbacks;
    this.callbacks.onClick = callbacks.onClick || (() => {});

    this.navigationBar = document.createElement('div');
    this.navigationBar.setAttribute('role', 'button');
    this.navigationBar.setAttribute('tabIndex', 0);
    this.navigationBar.setAttribute('aria-label', this.params.label);
    this.navigationBar.classList.add(`${this.params.prefix}-navigation-bar`);
    this.navigationBar.classList.add(`${this.params.prefix}-navigation-bar-${this.params.position}`);

    const background = document.createElement('div');
    background.classList.add(`${this.params.prefix}-navigation-bar-background`);
    this.navigationBar.appendChild(background);

    this.navigationBar.addEventListener('click', () => {
      this.callbacks.onClick();
    });

    this.navigationBar.addEventListener('keypress', () => {
      this.callbacks.onClick();
    });

  }

  /**
   * Return the DOM for this class.
   * @return {HTMLElement} DOM for this class.
   */
  getDOM() {
    return this.navigationBar;
  }

  show() {
    this.navigationBar.classList.add(`${this.params.prefix}-navigation-bar-visible`);
  }

  hide() {
    this.navigationBar.classList.remove(`${this.params.prefix}-navigation-bar-visible`);
  }
}
