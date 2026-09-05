import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UNGROUPED_SECTION_TITLE } from '../list/list.service';
import {
  blankTitleError,
  DialogRenameComponent,
  RenameDialogData,
} from './dialog-rename.component';

describe('DialogRenameComponent', () => {
  let component: DialogRenameComponent;
  let fixture: ComponentFixture<DialogRenameComponent>;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DialogRenameComponent>>;
  let dialogData: RenameDialogData;

  /*
    The component reads its title in the constructor, so tests that need a
    different starting title or entity fill `dialogData` before rendering.
   */
  function render(): void {
    fixture = TestBed.createComponent(DialogRenameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function textOf(selector: string): string | null {
    const element = fixture.debugElement.query(By.css(selector));
    return element ? element.nativeElement.textContent.trim() : null;
  }

  function input(): HTMLInputElement {
    return fixture.debugElement.query(By.css('.rename-title')).nativeElement;
  }

  function errorText(): string | null {
    return textOf('.error-message');
  }

  beforeEach(async () => {
    dialogData = { entity: 'section', title: 'Electronics' };
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [DialogRenameComponent, NoopAnimationsModule],
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

    expect(component.title).toBe('Electronics');
    expect(input().value).toBe('Electronics');
  });

  /*
    The dialog is shared by sections and groups, and the entity it was opened for
    is the only thing that changes on screen.
   */
  describe('naming the thing being renamed', () => {
    it('should name a section', () => {
      render();

      expect(textOf('[mat-dialog-title]')).toBe('Rename section');
      expect(input().getAttribute('aria-label')).toBe('Section name');
    });

    it('should name a group', () => {
      dialogData.entity = 'group';

      render();

      expect(textOf('[mat-dialog-title]')).toBe('Rename group');
      expect(input().getAttribute('aria-label')).toBe('Group name');
    });
  });

  /*
    A mat-form-field with the outline appearance drew its border straight through
    the floating label, so the field is a plain input like the ones the add
    dialogs use. Named for screen readers instead of by a label.
   */
  it('should not use a mat-form-field', () => {
    render();

    expect(fixture.debugElement.query(By.css('mat-form-field'))).toBeNull();
  });

  /*
    Same cap as the add-section and add-item fields, so a title cannot be renamed
    into something longer than one that could have been created.
   */
  it('should cap the title at 40 characters', () => {
    render();

    expect(input().maxLength).toBe(40);
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

  it('should reject a blank section title and stay open', () => {
    render();
    component.title = '   ';

    component.onRename();
    fixture.detectChanges();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(errorText()).toBe(blankTitleError('section'));
  });

  it('should name the entity in the error of a blank group title', () => {
    dialogData.entity = 'group';
    render();
    component.title = '';

    component.onRename();
    fixture.detectChanges();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(errorText()).toBe('Please enter a group name');
  });

  /*
    Ungrouped is an ordinary section, so its name is not reserved any more than
    any other duplicate is — the add-section dialog accepts it too.
   */
  it('should accept the Ungrouped title like any other', () => {
    render();
    component.title = UNGROUPED_SECTION_TITLE;

    component.onRename();
    fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledWith(UNGROUPED_SECTION_TITLE);
    expect(errorText()).toBeNull();
  });

  it('should not show an error before anything is submitted', () => {
    render();

    expect(errorText()).toBeNull();
  });

  it('should rename when the field is submitted with Enter', () => {
    render();
    component.title = 'Beach gear';

    fixture.debugElement
      .query(By.css('.rename-title'))
      .triggerEventHandler('keyup.enter', {});

    expect(dialogRef.close).toHaveBeenCalledWith('Beach gear');
  });
});
