/**
 * Delay before a drag is picked up, per input type.
 *
 * On touch the delay is what makes the views scrollable: CDK abandons the drag
 * if the pointer moves past its 5px threshold before the delay elapses, so a
 * swipe scrolls the page and only a press-and-hold picks an element up.
 * Mouse stays at 0 so desktop drag-and-drop feels immediate.
 *
 * 250ms rather than iOS's ~500ms long-press threshold: a scroll fling clears
 * 5px in well under 100ms, so 250ms separates swipe from hold without the drag
 * feeling laggy.
 */
export const DRAG_START_DELAY: { touch: number; mouse: number } = {
  touch: 250,
  mouse: 0,
};
