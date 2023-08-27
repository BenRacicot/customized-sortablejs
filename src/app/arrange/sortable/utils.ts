import Sortable from './Sortable';
import {
  ICSSStyleDeclaration,
  IHTMLElement,
  SortableOptions,
  Void,
} from './types/index';

const captureMode = {
  capture: false,
  passive: false,
};

function on(
  el: IHTMLElement | Document,
  event: string,
  fn: ((evt: Event | TouchEvent | PointerEvent) => void) | Sortable
) {
  el.addEventListener(event, fn, captureMode);
}

function off(
  el: IHTMLElement | Document,
  event: string,
  fn: Sortable | ((e: TouchEvent | PointerEvent | Event) => void)
) {
  (el as IHTMLElement).removeEventListener(event, fn, captureMode);
}

function matches(
  /**IHTMLElement*/ el: IHTMLElement | Element,
  /**String*/ selector: string
) {
  if (!selector) return;

  selector[0] === '>' && (selector = selector.substring(1));

  if (el) {
    try {
      if (el.matches) {
        return el.matches(selector);
      } else if ((el as IHTMLElement).msMatchesSelector) {
        return (el as IHTMLElement).msMatchesSelector(selector);
      } else if (el.webkitMatchesSelector) {
        return el.webkitMatchesSelector(selector);
      }
    } catch (_) {
      return false;
    }
  }

  return false;
}

function getParentOrHost(el: IHTMLElement) {
  return el.host && (el as unknown as Document) !== document && el.host.nodeType
    ? el.host
    : el.parentNode;
}

function closest(
  /**IHTMLElement*/ el: IHTMLElement | Element,
  /**String*/ selector: string,
  /**IHTMLElement*/ ctx: IHTMLElement | Record<string, Sortable>,
  includeCTX: boolean
) {
  if (el) {
    ctx = ctx || document;

    do {
      if (
        (selector != null &&
          (selector[0] === '>'
            ? el.parentNode === ctx && matches(el, selector)
            : matches(el, selector))) ||
        (includeCTX && el === ctx)
      ) {
        return el;
      }

      if (el === ctx) break;
      /* jshint boss:true */
    } while ((el = getParentOrHost(el as IHTMLElement) as IHTMLElement));
  }

  return null;
}

const R_SPACE = /\s+/g;

function toggleClass(el: IHTMLElement, name: string, state: boolean) {
  if (el && name) {
    if (el.classList) {
      el.classList[state ? 'add' : 'remove'](name);
    } else {
      let className = (' ' + el.className + ' ')
        .replace(R_SPACE, ' ')
        .replace(' ' + name + ' ', ' ');
      el.className = (className + (state ? ' ' + name : '')).replace(
        R_SPACE,
        ' '
      );
    }
  }
}

function css(
  el: IHTMLElement | Element,
  prop?: keyof ICSSStyleDeclaration,
  val?: ICSSStyleDeclaration | string | number
) {
  let style = (el && el.style) as ICSSStyleDeclaration;

  if (style) {
    if (val === void 0) {
      if (document.defaultView && document.defaultView.getComputedStyle) {
        val = document.defaultView.getComputedStyle(
          el,
          ''
        ) as unknown as ICSSStyleDeclaration;
      } else if ((el as IHTMLElement).currentStyle) {
        val = (el as IHTMLElement).currentStyle;
      }

      return prop === void 0 ? val : val?.[prop];
    } else {
      if (!(prop! in style) && (prop as string).indexOf('webkit') === -1) {
        prop = ('-webkit-' + prop) as keyof ICSSStyleDeclaration;
      }

      style[prop as number] = val + (typeof val === 'string' ? '' : 'px');
    }
  }

  return;
}

function matrix(el: IHTMLElement, selfOnly?: boolean) {
  let appliedTransforms = '';
  if (typeof el === 'string') {
    appliedTransforms = el;
  } else {
    do {
      let transform = css(el, 'transform');

      if (transform && transform !== 'none') {
        appliedTransforms = transform + ' ' + appliedTransforms;
      }
      /* jshint boss:true */
    } while (!selfOnly && (el = el.parentNode as IHTMLElement));
  }

  const matrixFn =
    window.DOMMatrix ||
    window.WebKitCSSMatrix ||
    window.CSSMatrix ||
    window.MSCSSMatrix;
  /*jshint -W056 */
  return matrixFn && new matrixFn(appliedTransforms);
}

function find(
  ctx: IHTMLElement,
  tagName: string,
  iterator: (el: IHTMLElement, i: number) => void
) {
  if (ctx) {
    let list = ctx.getElementsByTagName(tagName) as unknown as IHTMLElement[],
      i = 0,
      n = list.length;

    if (iterator) {
      for (; i < n; i++) {
        iterator(list[i], i);
      }
    }

    return list;
  }

  return [];
}

function getWindowScrollingElement() {
  let scrollingElement = document.scrollingElement;

  if (scrollingElement) {
    return scrollingElement;
  } else {
    return document.documentElement;
  }
}

/**
 * Returns the "bounding client rect" of given element
 * @param  {IHTMLElement} el                       The element whose boundingClientRect is wanted
 * @param  {[Boolean]} relativeToContainingBlock  Whether the rect should be relative to the containing block of (including) the container
 * @param  {[Boolean]} relativeToNonStaticParent  Whether the rect should be relative to the relative parent of (including) the contaienr
 * @param  {[Boolean]} undoScale                  Whether the container's scale() should be undone
 * @param  {[IHTMLElement]} container              The parent the element will be placed in
 * @return {Object}                               The boundingClientRect of el, with specified adjustments
 */
function getRect(
  el: IHTMLElement,
  relativeToContainingBlock?: boolean[] | boolean,
  relativeToNonStaticParent?: boolean[] | boolean,
  undoScale?: boolean[] | boolean,
  container?: IHTMLElement
): Partial<ICSSStyleDeclaration> | undefined {
  if (!el.getBoundingClientRect && el !== (window as unknown as IHTMLElement))
    return;

  let elRect, top, left, bottom, right, height, width;

  if (
    el !== (window as unknown as IHTMLElement) &&
    el.parentNode &&
    el !== getWindowScrollingElement()
  ) {
    elRect = el.getBoundingClientRect();
    top = elRect.top;
    left = elRect.left;
    bottom = elRect.bottom;
    right = elRect.right;
    height = elRect.height;
    width = elRect.width;
  } else {
    top = 0;
    left = 0;
    bottom = window.innerHeight;
    right = window.innerWidth;
    height = window.innerHeight;
    width = window.innerWidth;
  }

  if (
    (relativeToContainingBlock || relativeToNonStaticParent) &&
    el !== (window as unknown as IHTMLElement)
  ) {
    // Adjust for translate()
    container = container || (el.parentNode as IHTMLElement);

    // solves #1123 (see: https://stackoverflow.com/a/37953806/6088312)
    do {
      if (
        container &&
        container.getBoundingClientRect &&
        (css(container, 'transform') !== 'none' ||
          (relativeToNonStaticParent &&
            css(container, 'position') !== 'static'))
      ) {
        let containerRect = container.getBoundingClientRect();

        // Set relative to edges of padding box of container
        top -=
          containerRect.top +
          parseInt(
            css(
              container,
              'border-top-width' as keyof ICSSStyleDeclaration
            ) as string
          );
        left -=
          containerRect.left +
          parseInt(
            css(
              container,
              'border-left-width' as keyof ICSSStyleDeclaration
            ) as string
          );
        bottom = top + elRect?.height!;
        right = left + elRect?.width!;

        break;
      }
      /* jshint boss:true */
    } while ((container = container.parentNode as IHTMLElement));
  }

  if (undoScale && el !== (window as unknown as IHTMLElement)) {
    // Adjust for scale()
    let elMatrix = matrix(container || el),
      scaleX = elMatrix && elMatrix.a,
      scaleY = elMatrix && elMatrix.d;

    if (elMatrix) {
      top /= scaleY;
      left /= scaleX;

      width /= scaleX;
      height /= scaleY;

      bottom = top + height;
      right = left + width;
    }
  }

  return {
    top: top,
    left: left,
    bottom: bottom,
    right: right,
    width: width,
    height: height,
  };
}

function isScrolledPast(el: IHTMLElement, elSide: string, parentSide: string) {
  let parent = getParentAutoScrollElement(el, true) as IHTMLElement,
    elSideVal = getRect(el)?.[elSide as keyof ICSSStyleDeclaration]!;

  /* jshint boss:true */
  while (parent) {
    let parentSideVal =
        getRect(parent)?.[parentSide as keyof ICSSStyleDeclaration]!,
      visible;

    if (parentSide === 'top' || parentSide === 'left') {
      visible = elSideVal >= parentSideVal;
    } else {
      visible = elSideVal <= parentSideVal;
    }

    if (!visible) return parent;

    if (parent === getWindowScrollingElement()) break;

    parent = getParentAutoScrollElement(parent, false) as IHTMLElement;
  }

  return false;
}

/**
 * Gets nth child of el, ignoring hidden children, sortable's elements (does not ignore clone if it's visible)
 * and non-draggable elements
 * @param  {IHTMLElement} el       The parent element
 * @param  {Number} childNum      The index of the child
 * @param  {Object} options       Parent Sortable's options
 * @return {IHTMLElement}          The child at index childNum, or null if not found
 */
function getChild(
  el: IHTMLElement,
  childNum: number,
  options: SortableOptions,
  includeDragEl?: boolean
) {
  let currentChild = 0,
    i = 0,
    children = el.children;

  while (i < children.length) {
    if (
      children[i].style.display !== 'none' &&
      children[i] !== Sortable.ghost &&
      (includeDragEl || children[i] !== Sortable.dragged) &&
      closest(
        children[i] as IHTMLElement,
        options.draggable as string,
        el,
        false
      )
    ) {
      if (currentChild === childNum) {
        return children[i];
      }
      currentChild++;
    }

    i++;
  }
  return null;
}

/**
 * Gets the last child in the el, ignoring ghostEl or invisible elements (clones)
 * @param  {IHTMLElement} el       Parent element
 * @param  {selector} selector    Any other elements that should be ignored
 * @return {IHTMLElement}          The last child, ignoring ghostEl
 */
function lastChild(el: IHTMLElement, selector?: string) {
  let last = el.lastElementChild as IHTMLElement;

  while (
    last &&
    (last === Sortable.ghost ||
      css(last, 'display') === 'none' ||
      (selector && !matches(last, selector)))
  ) {
    last = last.previousElementSibling as IHTMLElement;
  }

  return last || null;
}

/**
 * Returns the index of an element within its parent for a selected set of
 * elements
 * @param  {IHTMLElement} el
 * @param  {selector} selector
 * @return {number}
 */
function index(el: IHTMLElement, selector?: string) {
  let index = 0;

  if (!el || !el.parentNode) {
    return -1;
  }

  /* jshint boss:true */
  while ((el = el.previousElementSibling as IHTMLElement)) {
    if (
      el.nodeName.toUpperCase() !== 'TEMPLATE' &&
      el !== Sortable.clone &&
      (!selector || matches(el, selector))
    ) {
      index++;
    }
  }

  return index;
}

/**
 * Returns the scroll offset of the given element, added with all the scroll offsets of parent elements.
 * The value is returned in real pixels.
 * @param  {IHTMLElement} el
 * @return {Array}             Offsets in the format of [left, top]
 */
function getRelativeScrollOffset(el: IHTMLElement) {
  let offsetLeft = 0,
    offsetTop = 0,
    winScroller = getWindowScrollingElement();

  if (el) {
    do {
      let elMatrix = matrix(el),
        scaleX = elMatrix.a,
        scaleY = elMatrix.d;

      offsetLeft += el.scrollLeft * scaleX;
      offsetTop += el.scrollTop * scaleY;
    } while (el !== winScroller && (el = el.parentNode as IHTMLElement));
  }

  return [offsetLeft, offsetTop];
}

/**
 * Returns the index of the object within the given array
 * @param  {Array} arr   Array that may or may not hold the object
 * @param  {Object} obj  An object that has a key-value pair unique to and identical to a key-value pair in the object you want to find
 * @return {Number}      The index of the object in the array, or -1
 */
function indexOfObject(arr: Array<Object>, obj: Object) {
  for (let i in arr) {
    if (!arr.hasOwnProperty(i)) continue;
    for (let key in obj) {
      if (
        obj.hasOwnProperty(key) &&
        obj[key as keyof Object] === arr[i][key as keyof Object]
      )
        return Number(i);
    }
  }
  return -1;
}

function getParentAutoScrollElement(el: IHTMLElement, includeSelf: boolean) {
  // skip to window
  if (!el || !el.getBoundingClientRect) return getWindowScrollingElement();

  let elem = el;
  let gotSelf = false;
  do {
    // we don't need to get elem css if it isn't even overflowing in the first place (performance)
    if (
      elem.clientWidth < elem.scrollWidth ||
      elem.clientHeight < elem.scrollHeight
    ) {
      let elemCSS = css(elem) as ICSSStyleDeclaration;
      if (
        (elem.clientWidth < elem.scrollWidth &&
          (elemCSS.overflowX == 'auto' || elemCSS.overflowX == 'scroll')) ||
        (elem.clientHeight < elem.scrollHeight &&
          (elemCSS.overflowY == 'auto' || elemCSS.overflowY == 'scroll'))
      ) {
        if (!elem.getBoundingClientRect || elem === document.body)
          return getWindowScrollingElement();

        if (gotSelf || includeSelf) return elem;
        gotSelf = true;
      }
    }
    /* jshint boss:true */
  } while ((elem = elem.parentNode as IHTMLElement));

  return getWindowScrollingElement();
}

function extend(
  dst: Record<string | number, unknown>,
  src: Record<string | number, unknown>
) {
  if (dst && src) {
    for (let key in src) {
      if (src.hasOwnProperty(key)) {
        dst[key] = src[key];
      }
    }
  }

  return dst;
}

function isRectEqual(
  rect1: Partial<ICSSStyleDeclaration>,
  rect2: Partial<ICSSStyleDeclaration>
) {
  return (
    Math.round(+rect1.top!) === Math.round(+rect2.top!) &&
    Math.round(+rect1.left!) === Math.round(+rect2.left!) &&
    Math.round(+rect1.height!) === Math.round(+rect2.height!) &&
    Math.round(+rect1.width!) === Math.round(+rect2.width!)
  );
}

let _throttleTimeout: NodeJS.Timeout | undefined;
function throttle(callback: (args: IArguments) => void, ms: number) {
  return function (this: ThisType<Void>) {
    if (!_throttleTimeout) {
      let args = arguments,
        _this = this;

      if (args.length === 1) {
        callback.call(_this, args[0]);
      } else {
        callback.apply(_this, args as unknown as [args: IArguments]);
      }

      _throttleTimeout = setTimeout(function () {
        _throttleTimeout = void 0;
      }, ms);
    }
  };
}

function cancelThrottle() {
  clearTimeout(_throttleTimeout);
  _throttleTimeout = void 0;
}

function scrollBy(el: IHTMLElement, x: number, y: number) {
  el.scrollLeft += x;
  el.scrollTop += y;
}

function clone(el: IHTMLElement) {
  return el.cloneNode(true);
}

function setRect(el: IHTMLElement, rect: ICSSStyleDeclaration) {
  css(el, 'position', 'absolute');
  css(el, 'top', rect.top);
  css(el, 'left', rect.left);
  css(el, 'width', rect.width);
  css(el, 'height', rect.height);
}

function unsetRect(el: IHTMLElement) {
  css(el, 'position', '');
  css(el, 'top', '');
  css(el, 'left', '');
  css(el, 'width', '');
  css(el, 'height', '');
}

const expando = 'Sortable' + new Date().getTime();

export {
  on,
  off,
  matches,
  getParentOrHost,
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
  indexOfObject,
  getParentAutoScrollElement,
  extend,
  isRectEqual,
  throttle,
  cancelThrottle,
  scrollBy,
  clone,
  setRect,
  unsetRect,
  expando,
};
