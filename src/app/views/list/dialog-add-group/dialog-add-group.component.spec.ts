import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { DialogAddGroupComponent } from './dialog-add-group.component';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Group } from 'src/app/views/group/group';

const MOCK_GROUPS: Group[] = [
  { id: 'g1', title: 'Packing', items: ['Passport'] },
  { id: 'g2', title: 'Documents', items: ['ID Card'] },
];

describe('DialogAddGroupComponent', () => {
  let component: DialogAddGroupComponent;
  let fixture: ComponentFixture<DialogAddGroupComponent>;
  let dialogData: { allGroups: Group[] };

  /*
    The component reads its groups in the constructor, so tests that need groups
    fill `dialogData` before rendering.
   */
  function render(): void {
    fixture = TestBed.createComponent(DialogAddGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  beforeEach(async () => {
    dialogData = { allGroups: [] };

    await TestBed.configureTestingModule({
      imports: [DialogAddGroupComponent],
      providers: [
        { provide: MatDialogRef, useValue: { close: jasmine.createSpy('close') } },
        { provide: MAT_DIALOG_DATA, useValue: dialogData },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    render();

    expect(component).toBeTruthy();
  });

  // --- new section field ---

  it('should return an empty new section title when nothing was typed', () => {
    render();

    expect(component.getResult().newSectionTitle).toBe('');
  });

  it('should return the typed new section title alongside the selected groups', () => {
    dialogData.allGroups = MOCK_GROUPS;
    render();
    component.onGroup('g2');
    component.newSectionTitle = 'Beach gear';

    const result = component.getResult();

    expect(result.newSectionTitle).toBe('Beach gear');
    expect(result.groups).toEqual([MOCK_GROUPS[1]]);
  });

  it('should render an input for the new section title', () => {
    render();

    expect(fixture.debugElement.query(By.css('.new-section-title'))).toBeTruthy();
  });

  /*
    The new-section field is the primary action of this dialog, so it has to
    come before the (optional) group picker rather than be buried under it.
   */
  it('should render the new section field above the group selection', () => {
    dialogData.allGroups = MOCK_GROUPS;
    render();
    const input: HTMLElement = fixture.debugElement.query(
      By.css('.new-section-title')
    ).nativeElement;
    const groupSelection: HTMLElement = fixture.debugElement.query(
      By.css('.group-selection')
    ).nativeElement;

    const relation = input.compareDocumentPosition(groupSelection);

    expect(relation & Node.DOCUMENT_POSITION_FOLLOWING)
      .withContext('group selection should follow the new section input')
      .toBeTruthy();
  });

  /*
    The two halves are separate choices. Packed tight, the group heading reads
    like a label belonging to the text field above it.
   */
  it('should leave the group selection clearly separated from the new section field', () => {
    dialogData.allGroups = MOCK_GROUPS;
    render();
    const input: HTMLElement = fixture.debugElement.query(
      By.css('.new-section-title')
    ).nativeElement;
    const groupSelection: HTMLElement = fixture.debugElement.query(
      By.css('.group-selection')
    ).nativeElement;

    const gap =
      groupSelection.getBoundingClientRect().top -
      input.getBoundingClientRect().bottom;

    expect(gap)
      .withContext('vertical gap in px between the field and the group picker')
      .toBeGreaterThanOrEqual(24);
  });
});
