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
  expect(dragElements.length)
    .withContext(
      'number of [cdkDrag] elements — if you added a draggable, bind ' +
        '[cdkDragStartDelay]="dragStartDelay" and update the expected count'
    )
    .toBe(expectedCount);

  dragElements.forEach((el, i) =>
    expect(el.injector.get(CdkDrag).dragStartDelay)
      .withContext(
        `[cdkDrag] #${i} (<${el.nativeElement.nodeName.toLowerCase()}>) is missing [cdkDragStartDelay]`
      )
      .toEqual(DRAG_START_DELAY)
  );
}
