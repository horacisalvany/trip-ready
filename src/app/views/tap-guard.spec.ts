import { TAP_MOVE_TOLERANCE_PX, TapGuard } from './tap-guard';

describe('TapGuard', () => {
  let guard: TapGuard;

  function press(x = 100, y = 100): void {
    guard.press({ clientX: x, clientY: y });
  }

  function isTapAt(x: number, y: number): boolean {
    return guard.isTap({ clientX: x, clientY: y });
  }

  beforeEach(() => {
    guard = new TapGuard();
  });

  it('should accept a click that lands where the press began', () => {
    press();

    expect(isTapAt(100, 100)).toBeTrue();
  });

  /*
    CDK does not suppress the click that follows a mouse drag, so a gesture that
    travelled has to be recognised here or it would fire the tap handler too.
   */
  it('should reject a click that ends beyond the tolerance', () => {
    press();

    expect(isTapAt(100 + TAP_MOVE_TOLERANCE_PX + 1, 100)).toBeFalse();
  });

  it('should accept a click that only wobbled within the tolerance', () => {
    press();

    expect(isTapAt(100 + TAP_MOVE_TOLERANCE_PX, 100)).toBeTrue();
  });

  it('should measure movement on both axes together', () => {
    press();

    expect(isTapAt(100 + TAP_MOVE_TOLERANCE_PX, 100 + 1)).toBeFalse();
  });

  /*
    A pointer click always follows a press on the same element. One that does not
    cannot be vouched for, so it is not treated as a tap.
   */
  it('should reject a click with no press recorded', () => {
    expect(isTapAt(100, 100)).toBeFalse();
  });

  /*
    The recorded press belongs to one click only. Otherwise it would keep
    vouching for later clicks, including the one that ends a drag.
   */
  it('should consume the press it vouched for', () => {
    press();

    expect(isTapAt(100, 100)).toBeTrue();
    expect(isTapAt(100, 100)).toBeFalse();
  });

  it('should consume the press even when it rejected the click', () => {
    press();

    expect(isTapAt(400, 400)).toBeFalse();
    expect(isTapAt(100, 100)).toBeFalse();
  });

  /*
    Keyboard activation has no pointer position to compare, so it is always a
    tap — and it must not be vouched for by a stale press either.
   */
  it('should accept an activation with no pointer event', () => {
    expect(guard.isTap()).toBeTrue();
  });

  it('should clear a pending press when activated by keyboard', () => {
    press();

    expect(guard.isTap()).toBeTrue();
    expect(isTapAt(100, 100)).toBeFalse();
  });
});
