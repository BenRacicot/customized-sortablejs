import { SortableOptions } from '../types';

export const repaint = (target: HTMLElement) => {
  return target.offsetWidth;
};

export const calculateRealTime = (
  animatingRect: Partial<CSSStyleDeclaration>,
  fromRect: Partial<CSSStyleDeclaration>,
  toRect: Partial<CSSStyleDeclaration>,
  options: SortableOptions
) => {
  return (
    (Math.sqrt(
      Math.pow(Number(fromRect.top) - Number(animatingRect.top), 2) +
        Math.pow(Number(fromRect.left) - Number(animatingRect.left), 2)
    ) /
      Math.sqrt(
        Math.pow(Number(fromRect.top) - Number(toRect.top), 2) +
          Math.pow(Number(fromRect.left) - Number(toRect.left), 2)
      )) *
    options.animation!
  );
};
