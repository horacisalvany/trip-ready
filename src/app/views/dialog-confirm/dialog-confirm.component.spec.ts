import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  ConfirmDialogData,
  DialogConfirmComponent,
} from './dialog-confirm.component';

describe('DialogConfirmComponent', () => {
  let fixture: ComponentFixture<DialogConfirmComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DialogConfirmComponent>>;

  const DATA: ConfirmDialogData = {
    heading: 'Unmark all items?',
    message: '12 items are marked as ready.',
    confirmLabel: 'Unmark all',
  };

  beforeEach(async () => {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [DialogConfirmComponent],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: DATA },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DialogConfirmComponent);
    fixture.detectChanges();
  });

  function click(selector: string): void {
    element(selector).click();
  }

  function element(selector: string): HTMLElement {
    return fixture.debugElement.query(By.css(selector)).nativeElement;
  }

  function textOf(selector: string): string | null {
    const found = fixture.debugElement.query(By.css(selector));
    return found ? found.nativeElement.textContent.trim() : null;
  }

  /*
    Asserted per element rather than against the dialog's whole text: the heading
    has to be the mat-dialog-title specifically, since that is what lends the
    container its aria-labelledby, and rendering it anywhere else would still
    read as present.
   */
  it('should show the question it was given', () => {
    expect(textOf('[mat-dialog-title]')).toBe('Unmark all items?');
    expect(textOf('.confirm-message')).toBe('12 items are marked as ready.');
    expect(textOf('.confirm')).toBe('Unmark all');
  });

  /*
    Only the confirm button is captioned by the caller; declining is always
    "Cancel", as it is in every other dialog.
   */
  it('should label the declining button Cancel', () => {
    expect(textOf('.cancel')).toBe('Cancel');
  });

  /*
    Cancel is the safe default for a question about something irreversible: Enter
    fires a button on keydown, so focus starting on the confirm button would let a
    held Enter from the opening control act before the question is read.
   */
  it('should start with focus on cancel rather than on the action', () => {
    expect(element('.cancel').hasAttribute('cdkFocusInitial')).toBe(true);
    expect(element('.confirm').hasAttribute('cdkFocusInitial')).toBe(false);
  });

  // See `onCancel` for why dismissal is undefined rather than false.
  it('should close with true when confirmed', () => {
    click('.confirm');

    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should close with false when cancelled', () => {
    click('.cancel');

    expect(dialogRef.close).toHaveBeenCalledWith(false);
  });
});
