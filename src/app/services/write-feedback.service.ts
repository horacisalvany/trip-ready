import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Observable } from 'rxjs';

/*
  Longer than the app's other snackbars (3s), because this one carries a loss
  the user has to act on — the change they just made is not saved — rather than
  an acknowledgement they can miss without cost.
 */
const DURATION_MS = 5000;

/*
  Reports a failed write to the user, naming the change that was lost.

  Every write in the app used to be fired with a bare `.subscribe()`, so a
  rejected write — offline, expired token, a rule refusing the path — left the
  screen showing the change and Firebase not holding it. This is the single
  place that turns that silence into a message.

  It subscribes rather than returning the observable: the caller has no decision
  left to make once the failure has been reported, and handing the error back is
  what produced a dozen different treatments of it in the first place.
 */
@Injectable({ providedIn: 'root' })
export class WriteFeedbackService {
  constructor(private snackBar: MatSnackBar) {}

  /**
   * Subscribes to a write and, if it fails, tells the user what was not saved.
   *
   * @param write the write to watch. Where one user action fires several
   *   writes, `forkJoin` them so the user gets one message, not one per write.
   * @param change what the user changed, as it should read after "Could not
   *   save" — `the new item`, `the mark`, `the deletion`.
   */
  report(write: Observable<unknown>, change: string): void {
    write.subscribe({
      error: () => {
        this.snackBar.open(
          `Could not save ${change}. Please try again.`,
          'OK',
          { duration: DURATION_MS }
        );
      },
    });
  }
}
