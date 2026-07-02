import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { CdkDropList, DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ListComponent } from './list.component';
import { ListService, UNGROUPED_SECTION_TITLE } from './list.service';
import { DialogShareListComponent } from './dialog-share-list/dialog-share-list.component';
import { GroupService } from '../group/group.service';
import { Group } from '../group/group';
import { List } from '../lists/list';
import { Section } from './section';

const MOCK_SECTIONS: Section[] = [
  { id: 'ungrouped', title: UNGROUPED_SECTION_TITLE, items: [] },
  { id: 's1', title: 'Packing', items: ['Passport', 'Tickets'], sourceGroupId: 'g1' },
  { id: 's2', title: 'Electronics', items: ['Phone', 'Charger'], sourceGroupId: 'g3' },
];

const MOCK_LIST: List = {
  id: 'list1',
  title: 'Paris Trip',
  sections: MOCK_SECTIONS.map((s) => ({ ...s, items: [...s.items] })),
};

const MOCK_GROUPS: Group[] = [
  { id: 'g1', title: 'Packing', items: ['Passport', 'Tickets'] },
  { id: 'g2', title: 'Documents', items: ['ID Card'] },
  { id: 'g3', title: 'Electronics', items: ['Phone', 'Charger'] },
];

describe('ListComponent', () => {
  let component: ListComponent;
  let fixture: ComponentFixture<ListComponent>;
  let mockListService: jasmine.SpyObj<ListService>;
  let mockGroupService: jasmine.SpyObj<GroupService>;

  beforeEach(async () => {
    mockListService = jasmine.createSpyObj('ListService', [
      'getList',
      'getSharedList',
      'addSectionToList',
      'removeSectionFromList',
      'updateSectionItems',
      'updateSharedSectionItems',
    ]);
    mockListService.getList.and.returnValue(
      of({
        ...MOCK_LIST,
        sections: MOCK_LIST.sections.map((s) => ({ ...s, items: [...s.items] })),
      })
    );
    mockListService.addSectionToList.and.returnValue(of('newSectionId'));
    mockListService.removeSectionFromList.and.returnValue(of(undefined));
    mockListService.updateSectionItems.and.returnValue(of(undefined));
    mockListService.getSharedList.and.returnValue(of({...MOCK_LIST, isShared: true, sections: MOCK_LIST.sections.map(s => ({...s, items: [...s.items]}))}));
    mockListService.updateSharedSectionItems.and.returnValue(of(undefined));

    mockGroupService = jasmine.createSpyObj('GroupService', ['getGroups']);
    mockGroupService.getGroups.and.returnValue(
      of(MOCK_GROUPS.map((g) => ({ ...g, items: [...g.items] })))
    );

    await TestBed.configureTestingModule({
      imports: [ListComponent, MatDialogModule, MatListModule, MatIconModule, DragDropModule],
      providers: [
        { provide: ListService, useValue: mockListService },
        { provide: GroupService, useValue: mockGroupService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => 'list1' }),
            data: of({}),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- ngOnInit / loading ---

  it('should load the list from route param on init', () => {
    expect(mockListService.getList).toHaveBeenCalledWith('list1');
    expect(component.list).toBeDefined();
    expect(component.list!.title).toBe('Paris Trip');
  });

  it('should have sections from the loaded list', () => {
    expect(component.list!.sections.length).toBe(3);
    expect(component.list!.sections[0].title).toBe(UNGROUPED_SECTION_TITLE);
    expect(component.list!.sections[1].title).toBe('Packing');
    expect(component.list!.sections[2].title).toBe('Electronics');
  });

  // --- onAddItemToSection ---

  it('should add an item to a section and call updateSectionItems', () => {
    component.onAddItemToSection('s1', 'Sunglasses');

    expect(mockListService.updateSectionItems).toHaveBeenCalledWith(
      'list1',
      's1',
      ['Passport', 'Tickets', 'Sunglasses']
    );
  });

  it('should trim whitespace from added items', () => {
    component.onAddItemToSection('s1', '  Hat  ');

    expect(mockListService.updateSectionItems).toHaveBeenCalledWith(
      'list1',
      's1',
      ['Passport', 'Tickets', 'Hat']
    );
  });

  it('should not add empty or whitespace-only items', () => {
    component.onAddItemToSection('s1', '   ');

    expect(mockListService.updateSectionItems).not.toHaveBeenCalled();
  });

  it('should not add item when list is undefined', () => {
    component.list = undefined;
    component.onAddItemToSection('s1', 'Item');

    expect(mockListService.updateSectionItems).not.toHaveBeenCalled();
  });

  // --- drag & drop setup ---

  it('should have a cdkDropList on the trash icon with explicit id', () => {
    const trashEl = fixture.debugElement.query(By.css('.trash-icon'));
    expect(trashEl).toBeTruthy();
    const dropList = trashEl.injector.get(CdkDropList, null);
    expect(dropList).toBeTruthy();
    expect(dropList!.id).toBe('trash-list');
  });

  it('should render sections and items as cdkDrag elements', () => {
    // 3 sections + 4 items (2 in Packing + 2 in Electronics)
    const dragElements = fixture.debugElement.queryAll(By.css('[cdkDrag]'));
    expect(dragElements.length).toBe(7);
  });

  // --- ungrouped section ---

  it('should identify ungrouped section correctly', () => {
    expect(component.isUngroupedSection(UNGROUPED_SECTION_TITLE)).toBeTrue();
    expect(component.isUngroupedSection('Packing')).toBeFalse();
  });

  it('should not remove ungrouped section when dropped on trash', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'sections' },
      container: { id: 'trash' },
      item: { data: { type: 'section', id: 'ungrouped' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockListService.removeSectionFromList).not.toHaveBeenCalled();
  });

  // --- dropTrash ---

  it('should remove a section when dropped on trash', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'sections' },
      container: { id: 'trash' },
      item: { data: { type: 'section', id: 's1' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockListService.removeSectionFromList).toHaveBeenCalledWith('list1', 's1');
  });

  it('should not remove section when drag data type is not section or item', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'sections' },
      container: { id: 'trash' },
      item: { data: { type: 'other', id: 'x1' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockListService.removeSectionFromList).not.toHaveBeenCalled();
    expect(mockListService.updateSectionItems).not.toHaveBeenCalled();
  });

  it('should not remove section when list is undefined', () => {
    component.list = undefined;
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'sections' },
      container: { id: 'trash' },
      item: { data: { type: 'section', id: 's1' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockListService.removeSectionFromList).not.toHaveBeenCalled();
  });

  // --- dropTrash for items ---

  it('should remove an item when dragged to trash', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'cdk-drop-list-section-s1' },
      container: { id: 'trash' },
      item: { data: { type: 'item', sectionId: 's1' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockListService.updateSectionItems).toHaveBeenCalledWith(
      'list1',
      's1',
      ['Tickets']
    );
  });

  it('should remove the correct item by index when dragged to trash', () => {
    const event = {
      previousIndex: 1,
      previousContainer: { id: 'cdk-drop-list-section-s2' },
      container: { id: 'trash' },
      item: { data: { type: 'item', sectionId: 's2' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockListService.updateSectionItems).toHaveBeenCalledWith(
      'list1',
      's2',
      ['Phone']
    );
  });

  it('should not remove item when list is undefined', () => {
    component.list = undefined;
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'cdk-drop-list-section-s1' },
      container: { id: 'trash' },
      item: { data: { type: 'item', sectionId: 's1' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockListService.updateSectionItems).not.toHaveBeenCalled();
  });

  // --- dropItem (reorder / transfer between sections) ---

  it('should reorder items within the same section', () => {
    const containerData = component.list!.sections[1].items;
    const event = {
      previousIndex: 0,
      currentIndex: 1,
      previousContainer: { id: 'cdk-drop-list-section-s1', data: containerData },
      container: { id: 'cdk-drop-list-section-s1', data: containerData },
    } as unknown as CdkDragDrop<string[]>;

    component.dropItem(event);

    expect(mockListService.updateSectionItems).toHaveBeenCalledWith(
      'list1',
      's1',
      ['Tickets', 'Passport']
    );
  });

  it('should transfer an item between sections', () => {
    const sourceData = component.list!.sections[1].items; // s1: Packing
    const targetData = component.list!.sections[2].items; // s2: Electronics
    const event = {
      previousIndex: 0,
      currentIndex: 1,
      previousContainer: { id: 'cdk-drop-list-section-s1', data: sourceData },
      container: { id: 'cdk-drop-list-section-s2', data: targetData },
    } as unknown as CdkDragDrop<string[]>;

    component.dropItem(event);

    // Source section updated (item removed)
    expect(mockListService.updateSectionItems).toHaveBeenCalledWith(
      'list1',
      's1',
      ['Tickets']
    );
    // Target section updated (item added)
    expect(mockListService.updateSectionItems).toHaveBeenCalledWith(
      'list1',
      's2',
      ['Phone', 'Passport', 'Charger']
    );
  });

  // --- recentlyDropped guard ---

  it('should not open dialog if called right after dropTrash', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'sections' },
      container: { id: 'trash' },
      item: { data: { type: 'section', id: 's1' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);
    component.openDialogAddGroup();

    expect(mockGroupService.getGroups).not.toHaveBeenCalled();
  });

  it('should open dialog again after recentlyDropped flag resets', (done) => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'sections' },
      container: { id: 'trash' },
      item: { data: { type: 'section', id: 's1' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    setTimeout(() => {
      mockGroupService.getGroups.calls.reset();
      const selectedGroups = [MOCK_GROUPS[0]];
      const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
      dialogRef.afterClosed.and.returnValue(of(selectedGroups));
      spyOn(component.dialog, 'open').and.returnValue(dialogRef);

      component.openDialogAddGroup();

      expect(mockGroupService.getGroups).toHaveBeenCalled();
      done();
    });
  });

  // --- openDialogAddGroup ---

  it('should fetch groups, open dialog, and create sections for selected groups', () => {
    const selectedGroups = [MOCK_GROUPS[1]]; // Documents
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of(selectedGroups));
    spyOn(component.dialog, 'open').and.returnValue(dialogRef);

    component.openDialogAddGroup();

    expect(mockGroupService.getGroups).toHaveBeenCalled();
    expect(component.dialog.open).toHaveBeenCalled();
    expect(mockListService.addSectionToList).toHaveBeenCalledWith(
      'list1',
      MOCK_GROUPS[1]
    );
  });

  it('should create a section for each selected group', () => {
    const selectedGroups = [MOCK_GROUPS[0], MOCK_GROUPS[2]];
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of(selectedGroups));
    spyOn(component.dialog, 'open').and.returnValue(dialogRef);

    component.openDialogAddGroup();

    expect(mockListService.addSectionToList).toHaveBeenCalledTimes(2);
    expect(mockListService.addSectionToList).toHaveBeenCalledWith('list1', MOCK_GROUPS[0]);
    expect(mockListService.addSectionToList).toHaveBeenCalledWith('list1', MOCK_GROUPS[2]);
  });

  it('should not create sections when dialog is cancelled', () => {
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of(undefined));
    spyOn(component.dialog, 'open').and.returnValue(dialogRef);

    component.openDialogAddGroup();

    expect(mockListService.addSectionToList).not.toHaveBeenCalled();
  });

  it('should not create sections when list is undefined', () => {
    component.list = undefined;
    const selectedGroups = [MOCK_GROUPS[0]];
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of(selectedGroups));
    spyOn(component.dialog, 'open').and.returnValue(dialogRef);

    component.openDialogAddGroup();

    expect(mockListService.addSectionToList).not.toHaveBeenCalled();
  });

  // --- openDialogAddGroup should only open dialog once (take(1)) ---

  it('should only open the dialog once even if getGroups emits multiple times', () => {
    const groups$ = new Subject<Group[]>();
    mockGroupService.getGroups.and.returnValue(groups$);

    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of(undefined));
    spyOn(component.dialog, 'open').and.returnValue(dialogRef);

    component.openDialogAddGroup();

    // First emission — should open the dialog
    groups$.next(MOCK_GROUPS);
    expect(component.dialog.open).toHaveBeenCalledTimes(1);

    // Second emission (e.g. a new group was added in Firebase) — should NOT open again
    groups$.next([...MOCK_GROUPS, { id: 'g4', title: 'New', items: [] }]);
    expect(component.dialog.open).toHaveBeenCalledTimes(1);
  });

  // --- share button ---

  it('should open share dialog when share button is clicked', () => {
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of(false));
    spyOn(component.dialog, 'open').and.returnValue(dialogRef);

    component.openShareDialog();

    expect(component.dialog.open).toHaveBeenCalledWith(
      DialogShareListComponent,
      jasmine.objectContaining({
        width: '300px',
        data: { listId: 'list1' },
      })
    );
  });

  it('should not open share dialog when list is undefined', () => {
    component.list = undefined;
    spyOn(component.dialog, 'open');

    component.openShareDialog();

    expect(component.dialog.open).not.toHaveBeenCalled();
  });

  // --- shared mode ---

  it('should have isShared false by default', () => {
    expect(component.isShared).toBeFalse();
  });

  // --- route param handling ---

  it('should not call getList when route param id is null', async () => {
    mockListService.getList.calls.reset();

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ListComponent, MatDialogModule, MatListModule, MatIconModule, DragDropModule],
      providers: [
        { provide: ListService, useValue: mockListService },
        { provide: GroupService, useValue: mockGroupService },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of({ get: () => null }),
            data: of({}),
          },
        },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(ListComponent);
    f.detectChanges();

    expect(mockListService.getList).not.toHaveBeenCalled();
  });
});
