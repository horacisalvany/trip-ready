import { fakeAsync, tick } from '@angular/core/testing';
import { keepInView } from './keep-in-view';

describe('keepInView', () => {
  it('scrolls the element into view with the minimum scroll', fakeAsync(() => {
    const el = document.createElement('div');
    const scrollIntoView = spyOn(el, 'scrollIntoView');

    keepInView(el);
    tick();

    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
  }));

  /*
    The caller runs before Angular has rendered the change that moves the
    element, so scrolling in the same turn would measure the old layout.
   */
  it('defers the scroll past the current turn', fakeAsync(() => {
    const el = document.createElement('div');
    const scrollIntoView = spyOn(el, 'scrollIntoView');

    keepInView(el);

    expect(scrollIntoView).not.toHaveBeenCalled();

    tick();

    expect(scrollIntoView).toHaveBeenCalled();
  }));

  it('does nothing when there is no element', fakeAsync(() => {
    expect(() => {
      keepInView(null);
      keepInView(undefined);
      tick();
    }).not.toThrow();
  }));
});
