import { Edge } from '../BrowserInfo';
import Sortable from '../Sortable';
import { SortableGroup, SortableOptions, ToFnValueCB, Void } from '../types';
import { css, expando, getChild, getRect, index, lastChild } from '../utils';

const CSSFloatProperty = Edge ? 'cssFloat' : 'float';

export const _globalDragOver = (/**Event*/ evt: Event) => {
  if (evt.dataTransfer) {
    evt.dataTransfer.dropEffect = 'move';
  }
  evt.cancelable && evt.preventDefault();
};

export const onMove = (
  fromEl: HTMLElement | null,
  toEl?: HTMLElement,
  dragEl?: HTMLElement | null,
  dragRect?: Partial<CSSStyleDeclaration> | undefined,
  targetEl?: HTMLElement,
  targetRect?: Partial<CSSStyleDeclaration> | undefined,
  originalEvent?: Event,
  willInsertAfter?: boolean
): boolean | number => {
  let evt,
    sortable = fromEl![expando as keyof HTMLElement] as unknown as Sortable,
    onMoveFn = sortable.options.onMove,
    retVal;
  // Support for new CustomEvent feature
  if (window.CustomEvent && !Edge) {
    evt = new CustomEvent('move', {
      bubbles: true,
      cancelable: true,
    });
  } else {
    evt = document.createEvent('Event');
    evt.initEvent('move', true, true);
  }

  evt.to = toEl;
  evt.from = fromEl!;
  evt.dragged = dragEl!;
  evt.draggedRect = dragRect;
  evt.related = targetEl || toEl;
  evt.relatedRect = targetRect || getRect(toEl!);
  evt.willInsertAfter = willInsertAfter;

  evt.originalEvent = originalEvent;

  fromEl!.dispatchEvent(evt);

  if (onMoveFn) {
    retVal = onMoveFn.call(
      sortable,
      evt as unknown as HTMLElement,
      originalEvent as unknown as HTMLElement
    );
  }

  return retVal as boolean;
};

export const _disableDraggable = (el: HTMLElement) => {
  el.draggable = false;
};

export const _ghostIsFirst = (
  evt: Event,
  vertical: boolean,
  sortable: Sortable
) => {
  let rect = getRect(
    getChild(sortable.el!, 0, sortable.options, true) as HTMLElement
  )!;
  const spacer = 10;

  return vertical
    ? evt.clientX! < Number(rect.left) - spacer ||
        (evt.clientY! < Number(rect.top) && evt.clientX! < Number(rect.right))
    : evt.clientY! < Number(rect.top) - spacer ||
        (evt.clientY! < Number(rect.bottom) &&
          evt.clientX! < Number(rect.left));
};

export const _ghostIsLast = (
  evt: Event,
  vertical: boolean,
  sortable: Sortable
) => {
  let rect = getRect(lastChild(sortable.el!, sortable.options.draggable!))!;
  const spacer = 10;

  return vertical
    ? evt.clientX! > Number(rect.right) + spacer ||
        (evt.clientX! <= Number(rect.right) &&
          evt.clientY! > Number(rect.bottom) &&
          evt.clientX! >= Number(rect.left))
    : (evt.clientX! > Number(rect.right) && evt.clientY! > Number(rect.top)) ||
        (evt.clientX! <= Number(rect.right) &&
          evt.clientY! > Number(rect.bottom) + spacer);
};

export const _getSwapDirection = (
  evt: Event,
  target: HTMLElement,
  targetRect: Partial<CSSStyleDeclaration> | undefined,
  vertical: boolean,
  swapThreshold: number | undefined,
  invertedSwapThreshold: number | undefined,
  invertSwap: boolean,
  isLastTarget: boolean,
  dragEl: HTMLElement | null,
  targetMoveDistance: number,
  pastFirstInvertThresh: boolean,
  lastDirection: number | null
) => {
  let mouseOnAxis = vertical ? evt.clientY : evt.clientX,
    targetLength = vertical ? targetRect!.height : targetRect!.width,
    targetS1 = vertical ? targetRect!.top : targetRect!.left,
    targetS2 = vertical ? targetRect!.bottom : targetRect!.right,
    invert = false;

  if (!invertSwap) {
    // Never invert or create dragEl shadow when target movemenet causes mouse to move past the end of regular swapThreshold
    if (
      isLastTarget &&
      targetMoveDistance < Number(targetLength) * swapThreshold!
    ) {
      // multiplied only by swapThreshold because mouse will already be inside target by (1 - threshold) * targetLength / 2
      // check if past first invert threshold on side opposite of lastDirection
      if (
        !pastFirstInvertThresh &&
        (lastDirection === 1
          ? mouseOnAxis! >
            Number(targetS1) +
              (Number(targetLength) * invertedSwapThreshold!) / 2
          : mouseOnAxis! <
            Number(targetS2) -
              (Number(targetLength) * invertedSwapThreshold!) / 2)
      ) {
        // past first invert threshold, do not restrict inverted threshold to dragEl shadow
        pastFirstInvertThresh = true;
      }

      if (!pastFirstInvertThresh) {
        // dragEl shadow (target move distance shadow)
        if (
          lastDirection === 1
            ? mouseOnAxis! < Number(targetS1) + targetMoveDistance // over dragEl shadow
            : mouseOnAxis! > Number(targetS2) - targetMoveDistance
        ) {
          return -lastDirection!;
        }
      } else {
        invert = true;
      }
    } else {
      // Regular
      if (
        mouseOnAxis! >
          Number(targetS1) +
            (Number(targetLength) * (1 - swapThreshold!)) / 2 &&
        mouseOnAxis! <
          Number(targetS2) - (Number(targetLength) * (1 - swapThreshold!)) / 2
      ) {
        return _getInsertDirection(target, dragEl!);
      }
    }
  }

  invert = invert || invertSwap;

  if (invert) {
    // Invert of regular
    if (
      mouseOnAxis! <
        Number(targetS1) +
          (Number(targetLength) * invertedSwapThreshold!) / 2 ||
      mouseOnAxis! >
        Number(targetS2) - (Number(targetLength) * invertedSwapThreshold!) / 2
    ) {
      return mouseOnAxis! > Number(targetS1) + Number(targetLength) / 2
        ? 1
        : -1;
    }
  }

  return 0;
};

/**
 * Gets the direction dragEl must be swapped relative to target in order to make it
 * seem that dragEl has been "inserted" into that element's position
 * @param  {HTMLElement} target       The target whose position dragEl is being inserted at
 * @return {Number}                   Direction dragEl must be swapped
 */
export const _getInsertDirection = (
  target: HTMLElement,
  dragEl: HTMLElement
) => {
  if (index(dragEl as Element) < index(target as Element)) {
    return 1;
  } else {
    return -1;
  }
};

/**
 * Generate id
 * @param   {HTMLElement} el
 * @returns {String}
 * @private
 */
export const _generateId = (
  el: HTMLImageElement | HTMLAnchorElement | HTMLElement
) => {
  let str =
      el.tagName +
      el.className +
      (el as HTMLImageElement).src +
      (el as HTMLAnchorElement).href +
      el.textContent,
    i = str.length,
    sum = 0;

  while (i--) {
    sum += str.charCodeAt(i);
  }

  return sum.toString(36);
};

export const _saveInputCheckedState = (
  root: HTMLElement,
  savedInputChecked: HTMLInputElement[]
) => {
  savedInputChecked.length = 0;

  let inputs = root.getElementsByTagName('input');
  let idx = inputs.length;

  while (idx--) {
    let el = inputs[idx];
    el.checked && savedInputChecked.push(el);
  }
};

export const _nextTick = (fn: Void) => {
  return setTimeout(fn, 0);
};

export const _cancelNextTick = (id?: ReturnType<typeof setTimeout>) => {
  return clearTimeout(id);
};

export const checkCssPointerEventSupport = (documentExists: boolean) => {
  if (!documentExists) return;

  let el = document.createElement('x');
  el.style.cssText = 'pointer-events:auto';
  return el.style.pointerEvents === 'auto';
};

export const _detectDirection = (el: HTMLElement, options: SortableOptions) => {
  let elCSS = css(el) as CSSStyleDeclaration,
    elWidth =
      parseInt(elCSS.width.toString()) -
      parseInt(elCSS.paddingLeft) -
      parseInt(elCSS.paddingRight) -
      parseInt(elCSS.borderLeftWidth) -
      parseInt(elCSS.borderRightWidth),
    child1 = getChild(el, 0, options) as HTMLElement,
    child2 = getChild(el, 1, options) as HTMLElement,
    firstChildCSS = child1 && (css(child1) as CSSStyleDeclaration),
    secondChildCSS = child2 && (css(child2) as CSSStyleDeclaration),
    firstChildWidth =
      firstChildCSS &&
      parseInt(firstChildCSS.marginLeft) +
        parseInt(firstChildCSS.marginRight) +
        getRect(child1!)!.width!,
    secondChildWidth =
      secondChildCSS &&
      parseInt(secondChildCSS.marginLeft) +
        parseInt(secondChildCSS.marginRight) +
        getRect(child2)!.width!;

  if (elCSS.display === 'flex') {
    return elCSS.flexDirection === 'column' ||
      elCSS.flexDirection === 'column-reverse'
      ? 'vertical'
      : 'horizontal';
  }

  if (elCSS.display === 'grid') {
    return elCSS.gridTemplateColumns.split(' ').length <= 1
      ? 'vertical'
      : 'horizontal';
  }

  if (child1 && firstChildCSS.float && firstChildCSS.float !== 'none') {
    let touchingSideChild2 = firstChildCSS.float === 'left' ? 'left' : 'right';

    return child2 &&
      (secondChildCSS.clear === 'both' ||
        secondChildCSS.clear === touchingSideChild2)
      ? 'vertical'
      : 'horizontal';
  }

  return child1 &&
    (firstChildCSS.display === 'block' ||
      firstChildCSS.display === 'flex' ||
      firstChildCSS.display === 'table' ||
      firstChildCSS.display === 'grid' ||
      (Number(firstChildWidth) >= elWidth &&
        elCSS[CSSFloatProperty] === 'none') ||
      (child2 &&
        elCSS[CSSFloatProperty] === 'none' &&
        Number(firstChildWidth) + Number(secondChildWidth) > elWidth))
    ? 'vertical'
    : 'horizontal';
};

export const _dragElInRowColumn = (
  dragRect: Partial<CSSStyleDeclaration>,
  targetRect: Partial<CSSStyleDeclaration>,
  vertical: boolean
) => {
  let dragElS1Opp = vertical ? dragRect.left : dragRect.top,
    dragElS2Opp = vertical ? dragRect.right : dragRect.bottom,
    dragElOppLength = vertical ? dragRect.width! : dragRect.height!,
    targetS1Opp = vertical ? targetRect.left : targetRect.top,
    targetS2Opp = vertical ? targetRect.right : targetRect.bottom,
    targetOppLength = vertical ? targetRect.width : targetRect.height;

  return (
    dragElS1Opp === targetS1Opp ||
    dragElS2Opp === targetS2Opp ||
    dragElS1Opp! + Number(dragElOppLength) / 2 ===
      targetS1Opp! + Number(targetOppLength) / 2
  );
};

/**
 * Detects first nearest empty sortable to X and Y position using emptyInsertThreshold.
 * @param  {Number} x      X position
 * @param  {Number} y      Y position
 * @return {HTMLElement}   Element of the first found nearest Sortable
 */
export const _detectNearestEmptySortable = (
  x: number,
  y: number,
  sortables: HTMLElement[]
) => {
  let ret: HTMLElement | undefined;
  sortables.some((sortable: HTMLElement) => {
    const threshold = (
      sortable[expando as keyof HTMLElement] as unknown as Sortable
    ).options.emptyInsertThreshold;
    if (!threshold || lastChild(sortable)) return;

    const rect = getRect(sortable)!,
      insideHorizontally =
        x >= Number(rect.left) - threshold &&
        x <= Number(rect.right) + threshold,
      insideVertically = 9;
    y >= Number(rect.top) - threshold && y <= Number(rect.bottom) + threshold;

    if (insideHorizontally && insideVertically) {
      return (ret = sortable);
    }
  });
  return ret;
};

export const _prepareGroup = (options: SortableOptions) => {
  function toFn(
    value: ToFnValueCB | boolean | string | null,
    pull?: boolean | undefined
  ) {
    return function (
      to: Sortable,
      from: Sortable,
      dragEl: HTMLElement,
      evt: Event
    ): boolean | string {
      let sameGroup =
        (to.options.group as unknown as SortableGroup).name &&
        (from.options.group as unknown as SortableGroup).name &&
        (to.options.group as unknown as SortableGroup).name ===
          (from.options.group as unknown as SortableGroup).name;

      if (value == null && (pull || sameGroup)) {
        // Default pull value
        // Default pull and put value if same group
        return true;
      } else if (value == null || value === false) {
        return false;
      } else if (pull && value === 'clone') {
        return value;
      } else if (typeof value === 'function') {
        return toFn(value(to, from, dragEl, evt), pull)(to, from, dragEl, evt);
      } else {
        let otherGroup = (
          (pull ? to : from).options.group as unknown as SortableGroup
        ).name;

        return (
          value === true ||
          (typeof value === 'string' && value === otherGroup) ||
          ((value as unknown as string[]).join &&
            value.indexOf(otherGroup!) > -1)
        );
      }
    };
  }

  let group = {} as SortableGroup;
  let originalGroup = options.group as unknown as SortableGroup;

  if (!originalGroup || typeof originalGroup != 'object') {
    originalGroup = { name: originalGroup };
  }

  group.name = originalGroup.name;
  group.checkPull = toFn(originalGroup.pull!, true);
  group.checkPut = toFn(originalGroup.put!);
  group.revertClone = originalGroup.revertClone;

  options.group = group as unknown as string;
};

export const _hideGhostForTarget = (
  ghostEl: HTMLElement | null,
  documentExists: boolean
) => {
  if (!checkCssPointerEventSupport(documentExists) && ghostEl) {
    css(ghostEl, 'display', 'none');
  }
};

export const _unhideGhostForTarget = (
  ghostEl: HTMLElement | null,
  documentExists?: boolean
) => {
  if (!checkCssPointerEventSupport(documentExists!) && ghostEl) {
    css(ghostEl, 'display', '');
  }
};

export const nearestEmptyInsertDetectEvent = (
  evt: Event,
  dragEl: HTMLElement | null,
  sortables: HTMLElement[]
) => {
  if (dragEl) {
    evt = (evt.touches ? evt.touches[0] : evt) as Event;
    let nearest = _detectNearestEmptySortable(
      evt.clientX!,
      evt.clientY!,
      sortables
    );

    if (nearest) {
      // Create imitation event
      let event: Record<string, Event[keyof Event]> | Event = {};
      for (let i in evt) {
        if (evt.hasOwnProperty(i)) {
          event[i] = evt[i as keyof Event];
        }
      }
      event['target'] = event['rootEl'] = nearest;
      event['preventDefault'] = void 0;
      event['stopPropagation'] = void 0;
      (
        nearest[expando as keyof HTMLElement] as unknown as Sortable
      )?._onDragOver(event as unknown as Event);
    }
  }
};

export const _checkOutsideTargetEl = (
  evt: Event,
  dragEl: HTMLElement | null
) => {
  if (dragEl) {
    (
      dragEl!.parentNode![expando as keyof ParentNode] as unknown as Sortable
    )._isOutsideThisEl(evt.target as Node);
  }
};
