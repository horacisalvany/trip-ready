import { TestBed } from '@angular/core/testing';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { WriteFeedbackService } from './write-feedback.service';

describe('WriteFeedbackService', () => {
  let service: WriteFeedbackService;
  let snackBar: MatSnackBar;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MatSnackBarModule] });
    service = TestBed.inject(WriteFeedbackService);
    snackBar = TestBed.inject(MatSnackBar);
    spyOn(snackBar, 'open');
  });

  it('names the change that was not saved', () => {
    service.report(throwError(() => new Error('nope')), 'the new item');

    expect(snackBar.open).toHaveBeenCalledWith(
      'Could not save the new item. Please try again.',
      'OK',
      jasmine.any(Object)
    );
  });

  /*
    Failure feedback, not a save indicator: a working app must stay silent, or
    every tap in checklist mode would raise a message.
   */
  it('says nothing when the write succeeds', () => {
    service.report(of(undefined), 'the mark');

    expect(snackBar.open).not.toHaveBeenCalled();
  });

  /*
    The report is the whole handling. If the error escaped, it would surface
    again through Angular's ErrorHandler as a second, generic complaint.
   */
  it('swallows the error rather than rethrowing it', () => {
    expect(() =>
      service.report(throwError(() => new Error('nope')), 'the deletion')
    ).not.toThrow();
  });

  /*
    Dismissible and non-blocking (F10): an action button to dismiss, and a
    duration so an unread message does not sit on the screen forever.
   */
  it('offers a way to dismiss the message', () => {
    service.report(throwError(() => new Error('nope')), 'the deletion');

    const [, action, config] = (snackBar.open as jasmine.Spy).calls.mostRecent()
      .args as [string, string, { duration: number }];

    expect(action).toBe('OK');
    expect(config.duration).toBeGreaterThan(0);
  });
});
