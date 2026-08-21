import { DRAG_START_DELAY } from './drag-config';

describe('DRAG_START_DELAY', () => {
  it('should delay touch drags so a swipe scrolls the page instead of dragging', () => {
    expect(DRAG_START_DELAY.touch).toBeGreaterThan(0);
  });

  it('should not delay mouse drags so desktop drag-and-drop stays immediate', () => {
    expect(DRAG_START_DELAY.mouse).toBe(0);
  });
});
