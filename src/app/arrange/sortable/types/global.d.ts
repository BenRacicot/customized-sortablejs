import { SortableOptions } from './Sortable';
import { HTMLElement } from './override';

declare global {
  var modifiedValue: SortableOptions[keyof SortableOptions] | undefined;

  interface Window {
    CSSMatrix: string;
    MSCSSMatrix: unknown;
  }

  interface Element {
    style: CSSStyleDeclaration & {
      'will-change': string;
    };
  }

  interface Event {
    pointerType?: string;
    path?: string | string[];
    button?: number;
    dataTransfer: {
      effectAllowed: string;
      dropEffect: string;
    };
    rootEl?: HTMLElement;
    to?: HTMLElement;
    from?: HTMLElement;
    dragged?: HTMLElement;
    draggedRect?: Partial<CSSStyleDeclaration>;
    related?: HTMLElement;
    relatedRect?: Partial<CSSStyleDeclaration>;
    willInsertAfter?: boolean;
    originalEvent?: Event;
    clientY?: number;
    clientX?: number;
    touches?: TouchList;
  }

  interface EventTarget {
    isContentEditable?: boolean;
    dataTransfer?: unknown;
    animated?: unknown;
    animatingX?: unknown;
    animatingY?: unknown;
    toRect?: unknown;
    nextElementSibling?: HTMLElement;
  }

  interface Document {
    selection: Selection;
  }

  interface MouseEvent {
    rootEl?: HTMLElement;
  }

  interface HTMLElement {
    animated: any;
    msMatchesSelector: (selector: string) => void;
    currentStyle: CSSStyleDeclaration;
    host: {
      nodeType: string;
    };
    toRect: Partial<CSSStyleDeclaration> | null;
    fromRect: Partial<CSSStyleDeclaration> | null;
    prevToRect: Partial<CSSStyleDeclaration> | null;
    prevFromRect: Partial<CSSStyleDeclaration> | null;
    thisAnimationDuration?: number | null;
    animationResetTimer?: ReturnType<typeof setTimeout>;
    animationTime?: number;
  }
}

export type Void = () => void;
