/*
  How far the pointer may travel between pressing something and releasing it and
  still count as a tap. Same 5px CDK uses to decide a drag has begun, so a
  gesture is either a tap or a drag, never both.
 */
export const TAP_MOVE_TOLERANCE_PX = 5;

/** The part of a MouseEvent a tap is judged by. */
interface PointerPosition {
  clientX: number;
  clientY: number;
}

/*
  Tells a tap from the click that ends a drag, for a tappable element that also
  lives inside a cdkDragHandle — a section title, a group title. CDK prevents the
  default on a mouse move but that does not suppress the following click, so a
  header dragged a few pixels would otherwise fire the tap handler on release.

  Deliberately derived from the pointer position rather than from a flag toggled
  by cdkDragStarted/cdkDragEnded: a card dropped on the trash can be gone from
  the DOM before cdkDragEnded fires, which would leave such a flag stuck on and
  silently break tapping from then on.
 */
export class TapGuard {
  private pressedAt: PointerPosition | null = null;

  press(event: PointerPosition): void {
    this.pressedAt = { clientX: event.clientX, clientY: event.clientY };
  }

  /*
    Whether this activation is a tap. The recorded press is consumed either way,
    so it can never vouch for a second click. Called without an event — keyboard
    activation — there is no position to compare and it is always a tap.
   */
  isTap(event?: PointerPosition): boolean {
    const pressedAt = this.pressedAt;
    this.pressedAt = null;

    if (!event) return true;
    if (!pressedAt) return false;

    const moved =
      Math.abs(event.clientX - pressedAt.clientX) +
      Math.abs(event.clientY - pressedAt.clientY);
    return moved <= TAP_MOVE_TOLERANCE_PX;
  }
}
