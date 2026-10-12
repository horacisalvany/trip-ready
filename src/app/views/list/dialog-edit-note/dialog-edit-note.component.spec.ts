import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  DialogEditNoteComponent,
  EditNoteDialogData,
  NOTE_MAX_LENGTH,
  noteTooLongError,
} from './dialog-edit-note.component';

describe('DialogEditNoteComponent', () => {
  let component: DialogEditNoteComponent;
  let fixture: ComponentFixture<DialogEditNoteComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DialogEditNoteComponent>>;
  let dialogData: EditNoteDialogData;

  /*
    The component reads its note in the constructor, so tests that need a
    different starting note fill `dialogData` before rendering.
   */
  function render(): void {
    fixture = TestBed.createComponent(DialogEditNoteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function textOf(selector: string): string | null {
    const element = fixture.debugElement.query(By.css(selector));
    return element ? element.nativeElement.textContent.trim() : null;
  }

  function field(): HTMLTextAreaElement {
    return fixture.debugElement.query(By.css('.note-text')).nativeElement;
  }

  beforeEach(async () => {
    dialogData = { note: '1 week skiing' };
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [DialogEditNoteComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    render();

    expect(component).toBeTruthy();
  });

  it('should prefill the field with the current note', async () => {
    render();
    // ngModel writes the value to the field on a microtask, not during render.
    await fixture.whenStable();

    expect(field().value).toBe('1 week skiing');
  });

  it('should start empty when the list has no note', async () => {
    dialogData.note = undefined;

    render();
    await fixture.whenStable();

    expect(field().value).toBe('');
  });

  it('should be headed "Trip note"', () => {
    render();

    expect(textOf('[mat-dialog-title]')).toBe('Trip note');
  });

  /* Same reason as the rename dialog: the outline border cuts through the label. */
  it('should not use a mat-form-field', () => {
    render();

    expect(fixture.debugElement.query(By.css('mat-form-field'))).toBeNull();
  });

  it('should cap the note at 200 characters', () => {
    render();

    expect(NOTE_MAX_LENGTH).toBe(200);
    expect(field().maxLength).toBe(200);
  });

  it('should count the characters used', () => {
    render();
    component.note = 'abc';
    fixture.detectChanges();

    expect(textOf('.note-count')).toBe('3/200');
  });

  it('should close with the trimmed new note', () => {
    render();
    component.note = '  2 weeks Japan in November  ';

    component.onSave();

    expect(dialogRef.close).toHaveBeenCalledWith('2 weeks Japan in November');
  });

  /*
    Unlike a section or group title, a blank note is allowed: it means "no
    note", and closes with the empty string the caller writes as a clear.
   */
  it('should close with an empty note when a set note is blanked', () => {
    render();
    component.note = '   ';

    component.onSave();

    expect(dialogRef.close).toHaveBeenCalledWith('');
  });

  /* Not an error: nothing changed, so the caller has nothing to write. */
  it('should close without a value when the note is unchanged', () => {
    render();
    component.note = ' 1 week skiing ';

    component.onSave();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it('should treat a blank note on a list without one as unchanged', () => {
    dialogData.note = undefined;
    render();
    component.note = '  ';

    component.onSave();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it('should close with nothing when cancelled', () => {
    render();
    component.note = 'Something else';

    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });

  /*
    `maxlength` stops typing past the cap, but not a value set any other way;
    the dialog never hands back a note the service would store over the cap.
   */
  it('should reject a note over 200 characters and stay open', () => {
    render();
    component.note = 'x'.repeat(201);

    component.onSave();
    fixture.detectChanges();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(textOf('.error-message')).toBe(noteTooLongError());
  });

  it('should accept a note of exactly 200 characters', () => {
    render();
    component.note = 'x'.repeat(200);

    component.onSave();

    expect(dialogRef.close).toHaveBeenCalledWith('x'.repeat(200));
  });

  it('should not show an error before anything is submitted', () => {
    render();

    expect(textOf('.error-message')).toBeNull();
  });
});
