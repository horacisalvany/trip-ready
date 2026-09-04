import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UNGROUPED_SECTION_TITLE } from '../list.service';
import {
  BLANK_TITLE_ERROR,
  DialogRenameSectionComponent,
  RESERVED_TITLE_ERROR,
} from './dialog-rename-section.component';

describe('DialogRenameSectionComponent', () => {
  let component: DialogRenameSectionComponent;
  let fixture: ComponentFixture<DialogRenameSectionComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DialogRenameSectionComponent>>;
  let dialogData: { title: string };

  /*
    The component reads its title in the constructor, so tests that need a
    different starting title fill `dialogData` before rendering.
   */
  function render(): void {
    fixture = TestBed.createComponent(DialogRenameSectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function errorText(): string | null {
    const error = fixture.debugElement.query(By.css('.error-message'));
    return error ? error.nativeElement.textContent.trim() : null;
  }

  beforeEach(async () => {
    dialogData = { title: 'Electronics' };
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [DialogRenameSectionComponent, NoopAnimationsModule],
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

  it('should prefill the field with the current title', async () => {
    render();
    // ngModel writes the value to the input on a microtask, not during render.
    await fixture.whenStable();
    const input: HTMLInputElement = fixture.debugElement.query(
      By.css('.section-title')
    ).nativeElement;

    expect(component.title).toBe('Electronics');
    expect(input.value).toBe('Electronics');
  });

  /*
    Same cap as the add-section field, so a title cannot be renamed into
    something longer than one that could have been created.
   */
  it('should cap the title at 40 characters', () => {
    render();
    const input: HTMLInputElement = fixture.debugElement.query(
      By.css('.section-title')
    ).nativeElement;

    expect(input.maxLength).toBe(40);
  });

  it('should close with the trimmed new title', () => {
    render();
    component.title = '  Electronics and chargers  ';

    component.onRename();

    expect(dialogRef.close).toHaveBeenCalledWith('Electronics and chargers');
  });

  it('should close with nothing when cancelled', () => {
    render();
    component.title = 'Something else';

    component.onCancel();

    expect(dialogRef.close).toHaveBeenCalledWith();
  });

  /*
    Not an error: the user changed their mind rather than made a mistake, so the
    dialog closes and the caller has nothing to write.
   */
  it('should close without a value when the title is unchanged', () => {
    render();
    component.title = 'Electronics';

    component.onRename();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  it('should treat a title that only differs by whitespace as unchanged', () => {
    render();
    component.title = '  Electronics  ';

    component.onRename();

    expect(dialogRef.close).toHaveBeenCalledWith(undefined);
  });

  // --- validation ---

  it('should reject a blank title and stay open', () => {
    render();
    component.title = '   ';

    component.onRename();
    fixture.detectChanges();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(errorText()).toBe(BLANK_TITLE_ERROR);
  });

  /*
    "Ungrouped" identifies the default section by title all over the app, so a
    second section with that name would become undeletable and would compete for
    the top slot in the list.
   */
  it('should reject the reserved Ungrouped title and stay open', () => {
    render();
    component.title = UNGROUPED_SECTION_TITLE;

    component.onRename();
    fixture.detectChanges();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(errorText()).toBe(RESERVED_TITLE_ERROR);
  });

  it('should reject the reserved title even when padded with whitespace', () => {
    render();
    component.title = `  ${UNGROUPED_SECTION_TITLE}  `;

    component.onRename();

    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('should not show an error before anything is submitted', () => {
    render();

    expect(errorText()).toBeNull();
  });

  it('should rename when the field is submitted with Enter', () => {
    render();
    component.title = 'Beach gear';
    const input = fixture.debugElement.query(By.css('.section-title'));

    input.triggerEventHandler('keyup.enter', {});

    expect(dialogRef.close).toHaveBeenCalledWith('Beach gear');
  });
});
