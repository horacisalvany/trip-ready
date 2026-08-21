import { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { CdkDrag } from '@angular/cdk/drag-drop';
import { DRAG_START_DELAY } from './drag-config';

/**
 * Asserts every `cdkDrag` in the rendered fixture carries the shared touch
 * delay. The expected count is passed in rather than derived so that a drag
 * added without a delay fails loudly instead of being silently skipped.
 */
export function expectAllDragsHaveStartDelay(
  fixture: ComponentFixture<unknown>,
  expectedCount: number
): void {
  const dragElements = fixture.debugElement.queryAll(By.css('[cdkDrag]'));
  expect(dragElements.length).toBe(expectedCount);

  dragElements.forEach((el) =>
    expect(el.injector.get(CdkDrag).dragStartDelay).toEqual(DRAG_START_DELAY)
  );
}
