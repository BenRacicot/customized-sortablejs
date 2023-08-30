import { HTMLElement } from './override';

export interface AnimationState {
  target: HTMLElement;
  rect: Partial<CSSStyleDeclaration>;
}
