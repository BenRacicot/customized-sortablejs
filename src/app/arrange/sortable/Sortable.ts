/**!
 * Sortable
 * @author	RubaXa   <trash@rubaxa.org>
 * @author	owenm    <owen23355@gmail.com>
 * @license MIT
 */

import { Edge, FireFox, Safari, IOS, ChromeForAndroid } from './BrowserInfo.js';

import AnimationStateManager from './Animation.js';

import {
  on,
  off,
  closest,
  toggleClass,
  css,
  matrix,
  find,
  getWindowScrollingElement,
  getRect,
  isScrolledPast,
  getChild,
  lastChild,
  index,
  getRelativeScrollOffset,
  extend,
  throttle,
  scrollBy,
  clone,
  expando,
} from './utils';

import {
  _cancelNextTick,
  _checkOutsideTargetEl,
  _detectDirection,
  _detectNearestEmptySortable,
  _disableDraggable,
  _dragElInRowColumn,
  _generateId,
  _getSwapDirection,
  _ghostIsFirst,
  _ghostIsLast,
  _globalDragOver,
  _hideGhostForTarget,
  _nextTick,
  _prepareGroup,
  _saveInputCheckedState,
  _unhideGhostForTarget,
  checkCssPointerEventSupport,
  nearestEmptyInsertDetectEvent,
  onMove,
} from './helpers/sortable.js';
import { IHTMLElement } from './types/override.js';
import {
  SortableGroup,
  SortableOptions,
  SortableUtils,
} from './types/Sortable.js';
import { Void } from './types/global.js';

let dragEl: IHTMLElement | null,
  parentEl: IHTMLElement | null,
  ghostEl: IHTMLElement | null,
  rootEl: IHTMLElement | null,
  nextEl: IHTMLElement | null,
  lastDownEl: IHTMLElement | null,
  cloneEl: IHTMLElement | null,
  cloneHidden: boolean | null,
  oldIndex: number | null,
  newIndex: number | null,
  oldDraggableIndex: number | null,
  newDraggableIndex: number | null,
  activeGroup: SortableGroup | null | undefined,
  putSortable: Sortable | null,
  awaitingDragStarted = false,
  ignoreNextClick = false,
  sortables: any[] = [],
  tapEvt: MouseEvent | null,
  touchEvt: MouseEvent | null,
  lastDx: number,
  lastDy: number,
  tapDistanceLeft: number,
  tapDistanceTop: number,
  moved: boolean | null,
  lastTarget: EventTarget | null,
  lastDirection: number | null,
  pastFirstInvertThresh = false,
  isCircumstantialInvert = false,
  targetMoveDistance: number,
  // For positioning ghost absolutely
  ghostRelativeParent: IHTMLElement | null,
  ghostRelativeParentInitialScroll: number[] = [], // (left, top)
  _silent = false,
  savedInputChecked: any[] = [];

/** @const */
const documentExists = typeof document !== 'undefined';

const PositionGhostAbsolutely = IOS;
// This will not pass for IE9, because IE9 DnD only works on anchors
const supportDraggable =
  documentExists &&
  !ChromeForAndroid &&
  !IOS &&
  'draggable' in document.createElement('div');

// #1184 fix - Prevent click event on fallback if dragged but item not changed position
if (documentExists && !ChromeForAndroid) {
  document.addEventListener(
    'click',
    function (evt) {
      if (ignoreNextClick) {
        evt.preventDefault();
        evt.stopPropagation && evt.stopPropagation();
        evt.stopImmediatePropagation && evt.stopImmediatePropagation();
        ignoreNextClick = false;
        return false;
      }
    },
    true
  );
}

// Fixed #973:
if (documentExists) {
  on(
    document,
    'touchmove',
    function (evt: { cancelable: any; preventDefault: () => void }) {
      if ((Sortable.active || awaitingDragStarted) && evt.cancelable) {
        evt.preventDefault();
      }
    }
  );
}

/**
 * @class  Sortable
 * @param  {HTMLElement}  el
 * @param  {Object}       [options]
 */
class Sortable {
  static utils: SortableUtils;
  static version: number;
  static ghost: IHTMLElement | null;
  static clone: IHTMLElement | null;
  static dragged: IHTMLElement | null;
  static eventCanceled: any;
  static supportPointer: boolean;
  static active: Sortable | null;
  private _dragStartTimer: NodeJS.Timeout | undefined;

  el: IHTMLElement | null;
  options: SortableOptions;
  _ignoreWhileAnimating: EventTarget | null;
  defaults: SortableOptions;
  nativeDraggable: boolean;
  _lastX: number | undefined;
  _lastY: number | undefined;
  cloneId: NodeJS.Timeout | undefined;
  _loopId: NodeJS.Timer | undefined;
  _dragStartId: NodeJS.Timeout | undefined;
  lastPutMode: any;
  animateAll: ((arg?: Void) => void) | undefined;

  constructor(
    el: IHTMLElement & Record<string, Sortable>,
    options: Partial<SortableOptions>
  ) {
    if (!(el && el.nodeType && el.nodeType === 1)) {
      throw `Sortable: \`el\` must be an HTMLElement, not ${{}.toString.call(
        el
      )}`;
    }

    this.el = el; // root element
    this.options = options = Object.assign({}, options);
    this._ignoreWhileAnimating = null;

    // Export instance
    el[expando] = this;

    this.defaults = {
      group: null,
      sort: true,
      disabled: false,
      store: null,
      handle: null,
      draggable: /^[uo]l$/i.test(el.nodeName) ? '>li' : '>*',
      swapThreshold: 1,
      invertSwap: false,
      invertedSwapThreshold: null,
      removeCloneOnHide: true,
      direction: function (this: Sortable) {
        return _detectDirection(el, this.options);
      },
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      ignore: 'a, img',
      filter: null,
      preventOnFilter: true,
      animation: 0,
      easing: null,
      setData: function (
        dataTransfer: { setData: (arg0: string, arg1: any) => void },
        dragEl: { textContent: any }
      ) {
        dataTransfer.setData('Text', dragEl.textContent);
      },
      dropBubble: false,
      dragoverBubble: false,
      dataIdAttr: 'data-id',
      delay: 0,
      delayOnTouchOnly: false,
      touchStartThreshold:
        (!!Number.parseInt ? Number : window).parseInt(
          window.devicePixelRatio as unknown as string,
          10
        ) || 1,
      forceFallback: false,
      fallbackClass: 'sortable-fallback',
      fallbackOnBody: false,
      fallbackTolerance: 0,
      fallbackOffset: { x: 0, y: 0 },
      supportPointer:
        Sortable.supportPointer !== false &&
        'PointerEvent' in window &&
        !Safari,
      emptyInsertThreshold: 5,
    };

    // Set default options
    for (let name in this.defaults) {
      !(name in this.options) &&
        (this.options[name as keyof SortableOptions] =
          this.defaults[name as keyof SortableOptions]);
    }

    _prepareGroup(this.options);

    // Bind all private methods
    for (let fn in this) {
      if (fn.charAt(0) === '_' && typeof this[fn] === 'function') {
        this[fn] = (this[fn] as Void).bind(this) as this[Extract<
          keyof this,
          string
        >];
      }
    }

    // Setup drag mode
    this.nativeDraggable = this.options.forceFallback
      ? false
      : supportDraggable;

    if (this.nativeDraggable) {
      // Touch start threshold cannot be greater than the native dragstart threshold
      this.options.touchStartThreshold = 1;
    }

    // Bind events
    if (this.options.supportPointer) {
      on(el, 'pointerdown', this._onTapStart);
    } else {
      on(el, 'mousedown', this._onTapStart);
      on(el, 'touchstart', this._onTapStart);
    }

    if (this.nativeDraggable) {
      on(el, 'dragover', this);
      on(el, 'dragenter', this);
    }

    sortables.push(this.el);

    // Restore sorting
    this.options.store &&
      this.options.store.get &&
      this.sort((options.store?.get(this) as string[]) || []);

    // Add animation state manager
    Object.assign(this, new AnimationStateManager(this));
  }

  /**
   * Get the Sortable instance of an element
   * @param  {HTMLElement} element The element
   * @return {Sortable|undefined}         The instance of Sortable
   */
  static get(element: Sortable) {
    return element[expando as keyof Sortable] as Sortable;
  }
  /**
   * Create sortable instance
   * @param {HTMLElement}  el
   * @param {Object}      [options]
   */
  static create(el: any, options: any) {
    return new Sortable(el, options);
  }

  _isOutsideThisEl(target: any) {
    if (!(this.el as IHTMLElement).contains(target) && target !== this.el) {
      lastTarget = null;
    }
  }

  _getDirection(evt: Event, target: EventTarget) {
    return typeof this.options.direction === 'function'
      ? this.options.direction.call(this, evt, target, dragEl!)
      : this.options.direction;
  }

  _onTapStart(/** Event|TouchEvent */ evt: Event | TouchEvent) {
    if (!evt.cancelable) return;
    let _this = Sortable.get(this),
      el = this as unknown as IHTMLElement,
      options = _this.options,
      preventOnFilter = _this.options.preventOnFilter,
      type = evt.type,
      touch =
        ((evt as TouchEvent).touches && (evt as TouchEvent).touches[0]) ||
        (evt.pointerType && evt.pointerType === 'touch' && evt),
      target = (touch || evt).target as IHTMLElement,
      originalTarget = (((evt.target as Element)?.shadowRoot &&
        ((evt.path && evt.path[0]) ||
          (evt.composedPath && evt.composedPath()[0]))) ||
        target) as IHTMLElement,
      filter = options.filter;

    _saveInputCheckedState(el, savedInputChecked);

    // Don't trigger start event when an element is been dragged, otherwise the evt.oldindex always wrong when set option.group.
    if (dragEl) {
      return;
    }

    if (
      (/mousedown|pointerdown/.test(type) && evt.button !== 0) ||
      options.disabled
    ) {
      return; // only left button and enabled
    }

    // cancel dnd if original target is content editable
    if ((originalTarget as EventTarget).isContentEditable) {
      return;
    }

    // Safari ignores further event handling after mousedown
    if (
      !this.nativeDraggable &&
      Safari &&
      target &&
      target.tagName.toUpperCase() === 'SELECT'
    ) {
      return;
    }

    target = closest(target, options.draggable!, el, false) as IHTMLElement;

    if (target && target.animated) {
      return;
    }

    if (lastDownEl === target) {
      // Ignoring duplicate `down`
      return;
    }

    // Get the index of the dragged element within its parent
    oldIndex = index(target);
    oldDraggableIndex = index(target, options.draggable as string);

    // Check filter
    if (typeof filter === 'function') {
      if (filter.call(this, evt, target, this)) {
        preventOnFilter && evt.cancelable && evt.preventDefault();
        return; // cancel dnd
      }
    } else if (filter) {
      filter = (filter as string)
        .split(',')
        .some(function (criteria: string | IHTMLElement | null) {
          criteria = closest(
            originalTarget as IHTMLElement,
            (criteria as string).trim(),
            el,
            false
          ) as IHTMLElement;

          if (criteria) {
            return true;
          }

          return;
        });

      if (filter) {
        preventOnFilter && evt.cancelable && evt.preventDefault();
        return; // cancel dnd
      }
    }

    if (options.handle && !closest(originalTarget, options.handle, el, false)) {
      return;
    }

    // Prepare `dragstart`
    _this._prepareDragStart(evt, touch, target);
  }

  _prepareDragStart(
    /** Event */ evt: Event,
    /** Touch */ touch: Touch,
    /** HTMLElement */ target: IHTMLElement | null
  ) {
    let _this = Sortable.get(this.el as unknown as Sortable),
      el = this.el,
      options = _this.options,
      ownerDocument = el?.ownerDocument as Document,
      dragStartFn;

    if (target && !dragEl && target.parentNode === el) {
      let dragRect = getRect(target);
      rootEl = el;
      dragEl = target;
      parentEl = dragEl.parentNode as IHTMLElement;
      nextEl = dragEl.nextSibling as IHTMLElement;
      lastDownEl = target;
      activeGroup = options.group as unknown as SortableGroup;

      Sortable.dragged = dragEl;

      tapEvt = {
        target: dragEl,
        clientX: (touch || evt).clientX,
        clientY: (touch || evt).clientY,
      } as unknown as MouseEvent;

      tapDistanceLeft = tapEvt.clientX - dragRect?.['left']!;
      tapDistanceTop = tapEvt.clientY - dragRect?.['top']!;

      _this._lastX = (touch || evt).clientX;
      _this._lastY = (touch || evt).clientY;

      dragEl.style['will-change'] = 'all';

      dragStartFn = function () {
        if (Sortable.eventCanceled) {
          _this._onDrop();
          return;
        }
        // Delayed drag has been triggered
        // we can re-enable the events: touchmove/mousemove
        _this._disableDelayedDragEvents();

        if (!FireFox && _this.nativeDraggable) {
          dragEl!.draggable = true;
        }

        // Bind the events: dragstart/dragend
        _this._triggerDragStart(evt, touch);

        // Chosen item
        toggleClass(dragEl!, options.chosenClass as string, true);
      };

      // Disable "draggable"
      options.ignore?.split(',').forEach(function (criteria: string) {
        find(dragEl!, criteria.trim(), _disableDraggable);
      });

      const onCB = (evt: any) =>
        nearestEmptyInsertDetectEvent(evt, dragEl, sortables);

      on(ownerDocument, 'dragover', onCB);
      on(ownerDocument, 'mousemove', onCB);
      on(ownerDocument, 'touchmove', onCB);

      on(ownerDocument, 'mouseup', _this._onDrop.bind(_this));
      on(ownerDocument, 'touchend', _this._onDrop.bind(_this));
      on(ownerDocument, 'touchcancel', _this._onDrop.bind(_this));

      // Make dragEl draggable (must be before delay for FireFox)
      if (FireFox && this.nativeDraggable) {
        _this.options.touchStartThreshold = 4;
        dragEl.draggable = true;
      }

      // Delay is impossible for native DnD in Edge or IE
      if (
        options.delay &&
        (!options.delayOnTouchOnly || touch) &&
        (!this.nativeDraggable || !Edge)
      ) {
        if (Sortable.eventCanceled) {
          _this._onDrop();
          return;
        }
        // If the user moves the pointer or let go the click or touch
        // before the delay has been reached:
        // disable the delayed drag
        on(ownerDocument, 'mouseup', _this._disableDelayedDrag);
        on(ownerDocument, 'touchend', _this._disableDelayedDrag);
        on(ownerDocument, 'touchcancel', _this._disableDelayedDrag);
        on(ownerDocument, 'mousemove', _this._delayedDragTouchMoveHandler);
        on(ownerDocument, 'touchmove', _this._delayedDragTouchMoveHandler);
        options.supportPointer &&
          on(ownerDocument, 'pointermove', _this._delayedDragTouchMoveHandler);

        _this._dragStartTimer = setTimeout(dragStartFn, options.delay);
      } else {
        dragStartFn();
      }
    }
  }

  _delayedDragTouchMoveHandler(
    /** TouchEvent|PointerEvent **/ e: Event | TouchEvent | PointerEvent
  ) {
    let _this = Sortable.get(this);
    let touch = (e as TouchEvent).touches
      ? (e as TouchEvent).touches[0]
      : (e as PointerEvent);
    if (
      Math.max(
        Math.abs(touch.clientX - _this._lastX!),
        Math.abs(touch.clientY - _this._lastY!)
      ) >=
      Math.floor(
        _this.options.touchStartThreshold! /
          ((this.nativeDraggable && window.devicePixelRatio) || 1)
      )
    ) {
      _this._disableDelayedDrag();
    }
  }

  _disableDelayedDrag() {
    let _this = Sortable.get(this);
    dragEl && _disableDraggable(dragEl);
    clearTimeout(this._dragStartTimer as unknown as number);

    _this._disableDelayedDragEvents();
  }

  _disableDelayedDragEvents() {
    let ownerDocument = this.el?.ownerDocument as Document;
    off(ownerDocument, 'mouseup', this._disableDelayedDrag);
    off(ownerDocument, 'touchend', this._disableDelayedDrag);
    off(ownerDocument, 'touchcancel', this._disableDelayedDrag);
    off(ownerDocument, 'mousemove', this._delayedDragTouchMoveHandler);
    off(ownerDocument, 'touchmove', this._delayedDragTouchMoveHandler);
    off(ownerDocument, 'pointermove', this._delayedDragTouchMoveHandler);
  }

  _triggerDragStart(/** Event */ evt: Event, /** Touch */ touch: Touch) {
    touch = touch || (evt.pointerType == 'touch' && evt);

    if (!this.nativeDraggable || touch) {
      if (this.options.supportPointer) {
        on(document, 'pointermove', this._onTouchMove.bind(this));
      } else if (touch) {
        on(document, 'touchmove', this._onTouchMove.bind(this));
      } else {
        on(document, 'mousemove', this._onTouchMove.bind(this));
      }
    } else {
      on(dragEl!, 'dragend', this);
      on(rootEl!, 'dragstart', this._onDragStart.bind(this));
    }

    try {
      if (document.selection) {
        // Timeout neccessary for IE9
        _nextTick(function () {
          document.selection.empty();
        });
      } else {
        window.getSelection()?.removeAllRanges();
      }
    } catch (err) {}
  }

  _dragStarted(fallback?: boolean, _event?: Event) {
    awaitingDragStarted = false;
    if (rootEl && dragEl) {
      if (this.nativeDraggable) {
        on(document, 'dragover', (evt: any) =>
          _checkOutsideTargetEl(evt, dragEl)
        );
      }
      let options = this.options;

      // Apply effect
      !fallback && toggleClass(dragEl, options.dragClass!, false);
      toggleClass(dragEl, options.ghostClass!, true);

      Sortable.active = this;

      fallback && this._appendGhost();
    } else {
      this._nulling();
    }
  }

  _emulateDragOver() {
    if (touchEvt) {
      this._lastX = touchEvt.clientX;
      this._lastY = touchEvt.clientY;

      _hideGhostForTarget(ghostEl, documentExists);

      let target = document.elementFromPoint(
        touchEvt.clientX,
        touchEvt.clientY
      );
      let parent = target;

      while (target && target.shadowRoot) {
        target = target.shadowRoot.elementFromPoint(
          touchEvt.clientX,
          touchEvt.clientY
        );
        if (target === parent) break;
        parent = target;
      }

      (
        dragEl?.parentNode?.[expando as keyof ParentNode] as Sortable
      )?._isOutsideThisEl(target);

      if (parent) {
        do {
          if (parent[expando as keyof Element]) {
            let inserted;

            inserted = parent[expando as keyof Element] as unknown as Sortable;

            inserted?._onDragOver({
              clientX: touchEvt.clientX,
              clientY: touchEvt.clientY,
              target: target,
              rootEl: parent,
            } as unknown as MouseEvent);

            if (inserted && !this.options.dragoverBubble) {
              break;
            }
          }

          target = parent; // store last element
        } while (
          /* jshint boss:true */
          (parent = parent.parentNode as Element)
        );
      }

      _unhideGhostForTarget(ghostEl);
    }
  }

  _onTouchMove(/**TouchEvent*/ evt: Event | TouchEvent | PointerEvent) {
    if (tapEvt) {
      let options = this.options,
        fallbackTolerance = options.fallbackTolerance,
        fallbackOffset = options.fallbackOffset,
        touch = (evt as TouchEvent).touches
          ? (evt as TouchEvent).touches[0]
          : evt,
        ghostMatrix = ghostEl && matrix(ghostEl, true),
        scaleX = ghostEl && ghostMatrix && ghostMatrix.a,
        scaleY = ghostEl && ghostMatrix && ghostMatrix.d,
        relativeScrollOffset =
          PositionGhostAbsolutely &&
          ghostRelativeParent &&
          getRelativeScrollOffset(ghostRelativeParent),
        dx =
          ((touch as Touch).clientX - tapEvt.clientX + fallbackOffset.x) /
            (scaleX || 1) +
          (relativeScrollOffset
            ? relativeScrollOffset[0] - ghostRelativeParentInitialScroll[0]
            : 0) /
            (scaleX || 1),
        dy =
          ((touch as Touch).clientY - tapEvt.clientY + fallbackOffset.y) /
            (scaleY || 1) +
          (relativeScrollOffset
            ? relativeScrollOffset[1] - ghostRelativeParentInitialScroll[1]
            : 0) /
            (scaleY || 1);

      // only set the status to dragging, when we are actually dragging
      if (!Sortable.active && !awaitingDragStarted) {
        if (
          fallbackTolerance &&
          Math.max(
            Math.abs((touch as Touch).clientX - this._lastX!),
            Math.abs((touch as Touch).clientY - this._lastY!)
          ) < fallbackTolerance
        ) {
          return;
        }
        this._onDragStart(evt, true);
      }

      if (ghostEl) {
        if (ghostMatrix) {
          ghostMatrix.e += dx - (lastDx || 0);
          ghostMatrix.f += dy - (lastDy || 0);
        } else {
          ghostMatrix = {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: dx,
            f: dy,
          } as DOMMatrix;
        }

        let cssMatrix = `matrix(${ghostMatrix.a},${ghostMatrix.b},${ghostMatrix.c},${ghostMatrix.d},${ghostMatrix.e},${ghostMatrix.f})`;

        css(ghostEl, 'webkitTransform', cssMatrix);
        css(ghostEl, 'mozTransform', cssMatrix);
        css(ghostEl, 'msTransform', cssMatrix);
        css(ghostEl, 'transform', cssMatrix);

        lastDx = dx;
        lastDy = dy;

        touchEvt = touch as MouseEvent;
      }

      (evt as TouchEvent).cancelable && (evt as TouchEvent).preventDefault();
    }
  }

  _appendGhost() {
    // Bug if using scale(): https://stackoverflow.com/questions/2637058
    // Not being adjusted for
    if (!ghostEl) {
      let container = this.options.fallbackOnBody ? document.body : rootEl,
        rect = getRect(
          dragEl!,
          true,
          PositionGhostAbsolutely,
          true,
          container as IHTMLElement
        ),
        options = this.options;

      // Position absolutely
      if (PositionGhostAbsolutely) {
        // Get relatively positioned parent
        ghostRelativeParent = container as IHTMLElement;

        while (
          css(ghostRelativeParent!, 'position') === 'static' &&
          css(ghostRelativeParent!, 'transform') === 'none' &&
          ghostRelativeParent !== (document as unknown as IHTMLElement)
        ) {
          ghostRelativeParent = ghostRelativeParent.parentNode as IHTMLElement;
        }

        if (
          ghostRelativeParent !== document.body &&
          ghostRelativeParent !== document.documentElement
        ) {
          if (ghostRelativeParent === (document as unknown as IHTMLElement))
            ghostRelativeParent = getWindowScrollingElement() as IHTMLElement;

          rect!['top'] += ghostRelativeParent.scrollTop;
          rect!['left'] += ghostRelativeParent.scrollLeft;
        } else {
          ghostRelativeParent = getWindowScrollingElement() as IHTMLElement;
        }
        ghostRelativeParentInitialScroll =
          getRelativeScrollOffset(ghostRelativeParent);
      }

      ghostEl = dragEl?.cloneNode(true) as IHTMLElement;

      toggleClass(ghostEl, options.ghostClass!, false);
      toggleClass(ghostEl, options.fallbackClass!, true);
      toggleClass(ghostEl, options.dragClass!, true);

      css(ghostEl, 'transition', '');
      css(ghostEl, 'transform', '');

      css(ghostEl, 'box-sizing', 'border-box');
      css(ghostEl, 'margin', 0);
      css(ghostEl, 'top', rect?.['top']);
      css(ghostEl, 'left', rect?.['left']);
      css(ghostEl, 'width', rect?.['width']);
      css(ghostEl, 'height', rect?.['height']);
      css(ghostEl, 'opacity', '0.8');
      css(ghostEl, 'position', PositionGhostAbsolutely ? 'absolute' : 'fixed');
      css(ghostEl, 'zIndex', '100000');
      css(ghostEl, 'pointerEvents', 'none');

      Sortable.ghost = ghostEl;

      container?.appendChild(ghostEl);

      // Set transform-origin
      css(
        ghostEl,
        'transform-origin',
        (tapDistanceLeft / parseInt(ghostEl.style.width)) * 100 +
          '% ' +
          (tapDistanceTop / parseInt(ghostEl.style.height)) * 100 +
          '%'
      );
    }
  }

  _onDragStart(/**Event*/ evt?: Event, /**boolean*/ fallback?: boolean) {
    let dataTransfer = evt?.dataTransfer;
    let options = this.options;

    if (Sortable.eventCanceled) {
      this._onDrop();
      return;
    }

    if (!Sortable.eventCanceled) {
      cloneEl = clone(dragEl!) as IHTMLElement;
      cloneEl?.removeAttribute('id');
      cloneEl.draggable = false;
      cloneEl.style['will-change'] = '';

      this._hideClone();

      toggleClass(cloneEl, this.options.chosenClass!, false);
      Sortable.clone = cloneEl;
    }

    // #1143: IFrame support workaround
    const nextTickCB = () => {
      if (Sortable.eventCanceled) return;

      if (!this.options.removeCloneOnHide) {
        rootEl!.insertBefore(cloneEl!, dragEl);
      }
      this._hideClone();
    };

    this.cloneId = _nextTick(nextTickCB);

    !fallback && toggleClass(dragEl!, options.dragClass!, true);

    // Set proper drop events
    if (fallback) {
      ignoreNextClick = true;
      this._loopId = setInterval(this._emulateDragOver.bind(this), 50);
    } else {
      // Undo what was set in _prepareDragStart before drag started
      off(document, 'mouseup', this._onDrop.bind(this));
      off(document, 'touchend', this._onDrop.bind(this));
      off(document, 'touchcancel', this._onDrop.bind(this));

      if (dataTransfer) {
        dataTransfer.effectAllowed = 'move';
        options.setData && options.setData.call(this, dataTransfer, dragEl);
      }

      on(document, 'drop', this);

      // #1276 fix:
      css(dragEl!, 'transform', 'translateZ(0)');
    }

    awaitingDragStarted = true;

    this._dragStartId = _nextTick(this._dragStarted.bind(this, fallback, evt));
    on(document, 'selectstart', this);

    moved = true;

    if (Safari) {
      css(document.body as IHTMLElement, 'user-select', 'none');
    }
  }

  // Returns true - if no further action is needed (either inserted or another condition)
  _onDragOver(/**Event*/ evt: Event) {
    let el = this.el as IHTMLElement,
      _this = Sortable.get(el as unknown as Sortable),
      target = evt.target as IHTMLElement,
      dragRect,
      targetRect,
      revert,
      options = _this.options,
      group = options.group as unknown as SortableGroup,
      activeSortable = Sortable.active,
      isOwner = activeGroup === group,
      canSort = options.sort,
      fromSortable = putSortable || activeSortable,
      vertical,
      completedFired = false;

    if (_silent) return;

    // Capture animation state
    function capture() {
      _this.captureAnimationState();
      if (_this !== fromSortable) {
        fromSortable?.captureAnimationState();
      }
    }

    // Return invocation when dragEl is inserted (or completed)
    function completed(insertion: boolean) {
      if (insertion) {
        // Clones must be hidden before folding animation to capture dragRectAbsolute properly
        if (isOwner) {
          activeSortable?._hideClone();
        } else {
          activeSortable?._showClone(_this);
        }

        if (_this !== fromSortable) {
          // Set ghost class to new sortable's ghost class
          toggleClass(
            dragEl!,
            putSortable
              ? putSortable.options.ghostClass!
              : activeSortable?.options.ghostClass!,
            false
          );
          toggleClass(dragEl!, options.ghostClass!, true);
        }

        if (putSortable !== _this && _this !== Sortable.active) {
          putSortable = _this;
        } else if (_this === Sortable.active && putSortable) {
          putSortable = null;
        }

        // Animation
        if (fromSortable === _this) {
          _this._ignoreWhileAnimating = target;
        }
        _this.animateAll?.(function () {
          _this._ignoreWhileAnimating = null;
        });
        if (_this !== fromSortable) {
          fromSortable?.animateAll?.();
          fromSortable!._ignoreWhileAnimating = null;
        }
      }

      // Null lastTarget if it is not inside a previously swapped element
      if (
        (target === dragEl && !dragEl!.animated) ||
        (target === el && !target.animated)
      ) {
        lastTarget = null;
      }

      // no bubbling and not fallback
      if (
        !options.dragoverBubble &&
        !evt.rootEl &&
        target !== (document as unknown as IHTMLElement)
      ) {
        (
          dragEl?.parentNode?.[expando as keyof ParentNode] as Sortable
        )._isOutsideThisEl(evt.target);

        // Do not detect for empty insert if already inserted
        !insertion && nearestEmptyInsertDetectEvent(evt, dragEl, sortables);
      }

      !options.dragoverBubble && evt.stopPropagation && evt.stopPropagation();

      return (completedFired = true);
    }

    // Call when dragEl has been inserted
    function changed() {
      newIndex = index(dragEl!);
      newDraggableIndex = index(dragEl!, options.draggable);
    }

    if (evt.preventDefault !== void 0) {
      evt.cancelable && evt.preventDefault();
    }

    target = closest(
      target as Element,
      options.draggable!,
      el,
      true
    ) as IHTMLElement;

    if (Sortable.eventCanceled) return completedFired;

    if (
      dragEl?.contains(evt.target as Node) ||
      (target?.animated && target.animatingX && target.animatingY) ||
      this._ignoreWhileAnimating === target
    ) {
      return completed(false);
    }

    ignoreNextClick = false;

    if (
      activeSortable &&
      !options.disabled &&
      (isOwner
        ? canSort || (revert = parentEl !== rootEl) // Reverting item into the original list
        : putSortable === this ||
          ((this.lastPutMode = activeGroup?.checkPull(
            this,
            activeSortable,
            dragEl!,
            evt
          )) &&
            group?.checkPut(this, activeSortable, dragEl!, evt)))
    ) {
      vertical = this._getDirection(evt, target!) === 'vertical';

      dragRect = getRect(dragEl!);

      if (Sortable.eventCanceled) return completedFired;

      if (revert) {
        parentEl = rootEl; // actualization
        capture();

        this._hideClone();

        if (!Sortable.eventCanceled) {
          if (nextEl) {
            rootEl?.insertBefore(dragEl!, nextEl);
          } else {
            rootEl?.appendChild(dragEl!);
          }
        }

        return completed(true);
      }

      let elLastChild = lastChild(el as IHTMLElement, options.draggable!);

      if (
        !elLastChild ||
        (_ghostIsLast(evt, vertical, this) && !elLastChild.animated)
      ) {
        // Insert to end of list

        // If already at end of list: Do not insert
        if (elLastChild === dragEl) {
          return completed(false);
        }

        // if there is a last element, it is the target
        if (elLastChild && el === evt.target) {
          target = elLastChild;
        }

        if (target) {
          targetRect = getRect(target as IHTMLElement);
        }

        if (
          onMove(
            rootEl,
            el,
            dragEl,
            dragRect,
            target,
            targetRect,
            evt,
            !!target
          ) !== false
        ) {
          capture();
          if (elLastChild && elLastChild.nextSibling) {
            // the last draggable element is not the last node
            el.insertBefore(dragEl!, elLastChild.nextSibling);
          } else {
            el.appendChild(dragEl!);
          }
          parentEl = el; // actualization

          changed();
          return completed(true);
        }
      } else if (elLastChild && _ghostIsFirst(evt, vertical, this)) {
        // Insert to start of list
        let firstChild = getChild(el, 0, options, true);
        if (firstChild === dragEl) {
          return completed(false);
        }
        target = firstChild as IHTMLElement;
        targetRect = getRect(target);

        if (
          onMove(
            rootEl,
            el,
            dragEl,
            dragRect,
            target,
            targetRect,
            evt,
            false
          ) !== false
        ) {
          capture();
          el.insertBefore(dragEl!, firstChild);
          parentEl = el; // actualization

          changed();
          return completed(true);
        }
      } else if ((target as IHTMLElement)?.parentNode === el) {
        targetRect = getRect(target as IHTMLElement);
        let direction = 0,
          targetBeforeFirstSwap,
          differentLevel = dragEl!.parentNode !== el,
          differentRowCol = !_dragElInRowColumn(
            (dragEl!.animated && dragEl!.toRect) || dragRect,
            (target!.animated && target!.toRect) || targetRect,
            vertical
          ),
          side1 = vertical ? 'top' : 'left',
          scrolledPastTop =
            isScrolledPast(target as IHTMLElement, 'top', 'top') ||
            isScrolledPast(dragEl!, 'top', 'top'),
          scrollBefore = scrolledPastTop ? scrolledPastTop.scrollTop : void 0;

        if (lastTarget !== target) {
          targetBeforeFirstSwap = targetRect![side1];
          pastFirstInvertThresh = false;
          isCircumstantialInvert =
            (!differentRowCol && options.invertSwap) || differentLevel;
        }

        direction = _getSwapDirection(
          evt,
          target,
          targetRect,
          vertical,
          differentRowCol ? 1 : options.swapThreshold,
          options.invertedSwapThreshold == null
            ? options.swapThreshold
            : options.invertedSwapThreshold,
          isCircumstantialInvert,
          lastTarget === target,
          dragEl,
          targetMoveDistance,
          pastFirstInvertThresh,
          lastDirection
        );

        let sibling;

        if (direction !== 0) {
          // Check if target is beside dragEl in respective direction (ignoring hidden elements)
          let dragIndex = index(dragEl!);

          do {
            dragIndex -= direction;
            sibling = parentEl?.children[dragIndex];
          } while (
            sibling &&
            (css(sibling, 'display') === 'none' || sibling === ghostEl)
          );
        }
        // If dragEl is already beside target: Do not insert
        if (direction === 0 || sibling === target) {
          return completed(false);
        }

        lastTarget = target;

        lastDirection = direction;

        let nextSibling = target?.nextElementSibling,
          after = false;

        after = direction === 1;

        let moveVector = onMove(
          rootEl,
          el,
          dragEl,
          dragRect,
          target,
          targetRect,
          evt,
          after
        );

        if (moveVector !== false) {
          if (moveVector === 1 || moveVector === -1) {
            after = moveVector === 1;
          }

          _silent = true;
          setTimeout(() => (_silent = false), 30);

          capture();

          if (after && !nextSibling) {
            el.appendChild(dragEl!);
          } else {
            target?.parentNode?.insertBefore(
              dragEl!,
              after ? nextSibling! : target
            );
          }

          // Undo chrome's scroll adjustment (has no effect on other browsers)
          if (scrolledPastTop) {
            scrollBy(
              scrolledPastTop,
              0,
              scrollBefore! - scrolledPastTop.scrollTop
            );
          }

          parentEl = dragEl?.parentNode as IHTMLElement; // actualization

          // must be done before animation
          if (targetBeforeFirstSwap !== undefined && !isCircumstantialInvert) {
            targetMoveDistance = Math.abs(
              targetBeforeFirstSwap - getRect(target)?.[side1]!
            );
          }
          changed();

          return completed(true);
        }
      }

      if (el.contains(dragEl)) {
        return completed(false);
      }
    }

    return false;
  }

  captureAnimationState() {
    throw new Error('Method not implemented.');
  }

  _offMoveEvents() {
    const offCB = (evt: any) =>
      nearestEmptyInsertDetectEvent(evt, dragEl, sortables);

    off(document, 'mousemove', this._onTouchMove.bind(this));
    off(document, 'touchmove', this._onTouchMove.bind(this));
    off(document, 'pointermove', this._onTouchMove.bind(this));
    off(document, 'dragover', offCB);
    off(document, 'mousemove', offCB);
    off(document, 'touchmove', offCB);
  }

  _offUpEvents() {
    let ownerDocument = this.el?.ownerDocument as Document;

    off(ownerDocument, 'mouseup', this._onDrop.bind(this));
    off(ownerDocument, 'touchend', this._onDrop.bind(this));
    off(ownerDocument, 'pointerup', this._onDrop.bind(this));
    off(ownerDocument, 'touchcancel', this._onDrop.bind(this));
    off(document, 'selectstart', this);
  }

  _onDrop(
    /**Event*/ evt?:
      | {
          cancelable: any;
          preventDefault: () => any;
          stopPropagation: () => any;
        }
      | undefined
  ) {
    let el = this.el,
      options = this.options;

    // Get the index of the dragged element within its parent
    newIndex = index(dragEl!);
    newDraggableIndex = index(dragEl!, options.draggable);

    parentEl = dragEl && (dragEl.parentNode as IHTMLElement);

    // Get again after plugin event
    newIndex = index(dragEl!);
    newDraggableIndex = index(dragEl!, options.draggable);

    if (Sortable.eventCanceled) {
      this._nulling();
      return;
    }

    awaitingDragStarted = false;
    isCircumstantialInvert = false;
    pastFirstInvertThresh = false;

    clearInterval(this._loopId);

    clearTimeout(this._dragStartTimer);

    _cancelNextTick(this.cloneId);
    _cancelNextTick(this._dragStartId);

    // Unbind events
    if (this.nativeDraggable) {
      off(document, 'drop', this);
      off(el!, 'dragstart', this._onDragStart.bind(this));
    }
    this._offMoveEvents();
    this._offUpEvents();

    if (Safari) {
      css(document.body, 'user-select', '');
    }

    css(dragEl!, 'transform', '');

    if (evt) {
      if (moved) {
        evt.cancelable && evt.preventDefault();
        !options.dropBubble && evt.stopPropagation();
      }

      ghostEl && ghostEl.parentNode && ghostEl.parentNode.removeChild(ghostEl);

      if (
        rootEl === parentEl ||
        (putSortable && putSortable.lastPutMode !== 'clone')
      ) {
        // Remove clone(s)
        cloneEl &&
          cloneEl.parentNode &&
          cloneEl.parentNode.removeChild(cloneEl);
      }

      if (dragEl) {
        if (this.nativeDraggable) {
          off(dragEl, 'dragend', this);
        }

        _disableDraggable(dragEl);
        dragEl.style['will-change'] = '';

        // Remove classes
        // ghostClass is added in dragStarted
        if (moved && !awaitingDragStarted) {
          toggleClass(
            dragEl,
            putSortable
              ? putSortable.options.ghostClass!
              : this.options.ghostClass!,
            false
          );
        }
        toggleClass(dragEl, this.options.chosenClass!, false);

        if (rootEl !== parentEl) {
          putSortable && putSortable.save();
        }

        if (Sortable.active) {
          /* jshint eqnull:true */
          if (newIndex == null || newIndex === -1) {
            newIndex = oldIndex;
            newDraggableIndex = oldDraggableIndex;
          }

          // Save sorting
          this.save();
        }
      }
    }
    this._nulling();
  }

  _nulling() {
    rootEl =
      dragEl =
      parentEl =
      ghostEl =
      nextEl =
      cloneEl =
      lastDownEl =
      cloneHidden =
      tapEvt =
      touchEvt =
      moved =
      newIndex =
      newDraggableIndex =
      oldIndex =
      oldDraggableIndex =
      lastTarget =
      lastDirection =
      putSortable =
      activeGroup =
      Sortable.dragged =
      Sortable.ghost =
      Sortable.clone =
      Sortable.active =
        null;

    savedInputChecked.forEach(function (el) {
      el.checked = true;
    });

    savedInputChecked.length = lastDx = lastDy = 0;
  }

  handleEvent(/**Event*/ evt: Event) {
    switch (evt.type) {
      case 'drop':
      case 'dragend':
        this._onDrop(evt);
        break;

      case 'dragenter':
      case 'dragover':
        if (dragEl) {
          this._onDragOver(evt);
          _globalDragOver(evt);
        }
        break;

      case 'selectstart':
        evt.preventDefault();
        break;
    }
  }

  /**
   * Serializes the item into an array of string.
   * @returns {String[]}
   */
  toArray() {
    let _this = Sortable.get(this),
      order = [],
      el,
      children = this.el?.children,
      i = 0,
      n = children?.length,
      options = _this.options;

    for (; i < n!; i++) {
      el = children![i];
      if (closest(el, options.draggable!, this.el!, false)) {
        order.push(
          el.getAttribute(options.dataIdAttr!) ||
            _generateId(el as IHTMLElement)
        );
      }
    }

    return order;
  }

  sort(order: string[], useAnimation?: boolean) {
    let _this = Sortable.get(this),
      items = {} as Record<string, IHTMLElement>,
      rootEl = this.el as IHTMLElement;

    _this.toArray().forEach(function (id: string | number, i: number) {
      let el = rootEl.children[i];

      if (closest(el, _this.options.draggable!, rootEl, false)) {
        items[id] = el as IHTMLElement;
      }
    }, _this);

    useAnimation && _this.captureAnimationState();
    order.forEach(function (id) {
      if (items[id]) {
        rootEl.removeChild(items[id]);
        rootEl.appendChild(items[id]);
      }
    });
    useAnimation && _this.animateAll?.();
  }

  /**
   * Save the current sorting
   */
  save() {
    let store = this.options.store;
    store && store.set && store.set(this);
  }

  /**
   * For each element in the set, get the first element that matches the selector by testing the element itself and traversing up through its ancestors in the DOM tree.
   * @param   {HTMLElement}  el
   * @param   {String}       [selector]  default: `options.draggable`
   * @returns {HTMLElement|null}
   */
  closest(el: IHTMLElement, selector: any) {
    let _this = Sortable.get(this);
    return closest(el, selector || _this.options.draggable, this.el!, false);
  }

  /**
   * Set/get option
   * @param   {string} name
   * @param   {*}      [value]
   * @returns {*}
   */
  option(
    name: keyof SortableOptions,
    value: SortableOptions[keyof SortableOptions]
  ) {
    let options = this.options;

    if (value === void 0) {
      return options[name];
    } else {
      if (typeof modifiedValue !== 'undefined') {
        options[name] = modifiedValue;
      } else {
        options[name] = value;
      }

      if (name === 'group') {
        _prepareGroup(options);
      }
    }
  }

  /**
   * Destroy
   */
  destroy() {
    let _this = Sortable.get(this),
      el = this.el;

    (el as unknown as Record<string, unknown>)[expando] = null;

    off(el!, 'mousedown', _this._onTapStart);
    off(el!, 'touchstart', _this._onTapStart);
    off(el!, 'pointerdown', _this._onTapStart);

    if (this.nativeDraggable) {
      off(el!, 'dragover', _this);
      off(el!, 'dragenter', _this);
    }
    // Remove draggable attributes
    el!
      .querySelectorAll('[draggable]')
      ?.forEach((el: { removeAttribute: (arg0: string) => void }) => {
        el.removeAttribute('draggable');
      });

    _this._onDrop();

    _this._disableDelayedDragEvents();

    sortables.splice(sortables.indexOf(this.el), 1);

    this.el = el = null;
  }

  _hideClone() {
    if (!cloneHidden) {
      if (Sortable.eventCanceled) return;

      css(cloneEl!, 'display', 'none');
      if (this.options.removeCloneOnHide && cloneEl!.parentNode) {
        cloneEl!.parentNode.removeChild(cloneEl!);
      }
      cloneHidden = true;
    }
  }

  _showClone(putSortable: { lastPutMode: string }) {
    if (putSortable.lastPutMode !== 'clone') {
      this._hideClone();
      return;
    }

    if (cloneHidden) {
      if (Sortable.eventCanceled) return;

      // show clone at dragEl or original position
      if (
        dragEl!.parentNode == rootEl &&
        !(this.options.group as unknown as SortableGroup).revertClone
      ) {
        rootEl?.insertBefore(cloneEl!, dragEl);
      } else if (nextEl) {
        rootEl?.insertBefore(cloneEl!, nextEl);
      } else {
        rootEl?.appendChild(cloneEl!);
      }

      if ((this.options.group as unknown as SortableGroup).revertClone) {
        this.animate(dragEl, cloneEl);
      }

      css(cloneEl!, 'display', '');
      cloneHidden = false;
    }
  }
  animate(dragEl: IHTMLElement | null, cloneEl: IHTMLElement | null) {
    throw new Error('Method not implemented.');
  }
}

// Export utils
Sortable.utils = {
  on: on,
  off: off,
  css: css,
  find: find,
  is: function (el: IHTMLElement, selector: string) {
    return !!closest(el, selector, el, false);
  },
  extend: extend,
  throttle: throttle,
  closest: closest,
  toggleClass: toggleClass,
  clone: clone,
  index: index,
  nextTick: _nextTick,
  cancelNextTick: _cancelNextTick,
  detectDirection: _detectDirection,
  getChild: getChild,
};

// Export
Sortable.version = 1;

export default Sortable;