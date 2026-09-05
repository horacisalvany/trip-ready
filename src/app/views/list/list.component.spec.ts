import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule, MatTooltip } from '@angular/material/tooltip';
import { CdkDrag, CdkDropList, DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { ActivatedRoute } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ListComponent, formatSharedWith } from './list.component';
import { TAP_MOVE_TOLERANCE_PX } from '../tap-guard';
import { ListService, UNGROUPED_SECTION_TITLE } from './list.service';
import { DialogShareListComponent } from './dialog-share-list/dialog-share-list.component';
import { DialogRenameComponent } from '../dialog-rename/dialog-rename.component';
import { AddSectionsResult } from './dialog-add-group/dialog-add-group.component';
import { GroupService } from '../group/group.service';
import { AuthService } from '../../services/auth.service';
import { Group } from '../group/group';
import { List } from '../lists/list';
import { Section } from './section';
import { expectAllDragsHaveStartDelay } from '../drag-config.spec-helper';

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

/*
  What the add-sections dialog hands back: the groups that were ticked plus the
  title typed into the "new section" field (empty when the user typed nothing).
 */
function dialogResult(groups: Group[], newSectionTitle = ''): AddSectionsResult {
  return { groups, newSectionTitle };
}

describe('ListComponent', () => {
  let component: ListComponent;
  let fixture: ComponentFixture<ListComponent>;
  let mockListService: jasmine.SpyObj<ListService>;
  let mockGroupService: jasmine.SpyObj<GroupService>;
  let mockAuthService: { user$: Subject<{ uid: string } | null> };

  beforeEach(async () => {
    mockListService = jasmine.createSpyObj('ListService', [
      'getList',
      'getSharedList',
      'addSectionToList',
      'addEmptySectionToList',
      'removeSectionFromList',
      'updateSectionItems',
      'renameSection',
      'addSharedSectionToList',
      'addEmptySharedSectionToList',
      'updateSharedSectionItems',
      'renameSharedSection',
    ]);
    mockListService.getList.and.returnValue(
      of({
        ...MOCK_LIST,
        sections: MOCK_LIST.sections.map((s) => ({ ...s, items: [...s.items] })),
      })
    );
    mockListService.addSectionToList.and.returnValue(of('newSectionId'));
    mockListService.addEmptySectionToList.and.returnValue(of('newSectionId'));
    mockListService.removeSectionFromList.and.returnValue(of(undefined));
    mockListService.updateSectionItems.and.returnValue(of(undefined));
    mockListService.renameSection.and.returnValue(of(undefined));
    mockListService.getSharedList.and.returnValue(of({...MOCK_LIST, isShared: true, sections: MOCK_LIST.sections.map(s => ({...s, items: [...s.items]}))}));
    mockListService.addSharedSectionToList.and.returnValue(of('newSectionId'));
    mockListService.addEmptySharedSectionToList.and.returnValue(of('newSectionId'));
    mockListService.updateSharedSectionItems.and.returnValue(of(undefined));
    mockListService.renameSharedSection.and.returnValue(of(undefined));

    mockGroupService = jasmine.createSpyObj('GroupService', ['getGroups']);
    mockGroupService.getGroups.and.returnValue(
      of(MOCK_GROUPS.map((g) => ({ ...g, items: [...g.items] })))
    );

    mockAuthService = { user$: new Subject() };

    await TestBed.configureTestingModule({
      imports: [ListComponent, MatDialogModule, MatListModule, MatIconModule, MatTooltipModule, DragDropModule],
      providers: [
        { provide: ListService, useValue: mockListService },
        { provide: GroupService, useValue: mockGroupService },
        { provide: AuthService, useValue: mockAuthService },
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
    mockAuthService.user$.next({ uid: 'ownerUid' });
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

  it('should apply the shared touch drag delay to every draggable', () => {
    // 3 sections + 4 items (2 in Packing + 2 in Electronics)
    expectAllDragsHaveStartDelay(fixture, 7);
  });

  /*
    A cdkDrag only emits (cdkDropListDropped) if it lives inside a cdkDropList
    that is connected to the target list. CdkDrag resolves that container with
    @SkipSelf(), so a cdkDropList on the drag's own element never counts.
    Without an enclosing drop list a section is a free-floating drag: it stays
    wherever it is released and the trash handler is never called.
   */
  function connectedIds(dropList: CdkDropList): string[] {
    const connected = dropList.connectedTo;
    const asArray = Array.isArray(connected) ? connected : [connected];
    return asArray.map((entry) => (typeof entry === 'string' ? entry : entry.id));
  }

  it('should place each section drag in a drop list connected to the trash', () => {
    const sectionDrags = fixture.debugElement
      .queryAll(By.directive(CdkDrag))
      .map((el) => el.injector.get(CdkDrag))
      .filter((drag) => drag.data?.type === 'section');

    expect(sectionDrags.length).toBe(3);

    sectionDrags.forEach((drag) => {
      expect(drag.dropContainer)
        .withContext(`section ${drag.data.id} is not inside any cdkDropList`)
        .toBeTruthy();
      expect(connectedIds(drag.dropContainer))
        .withContext(`the drop list holding section ${drag.data.id}`)
        .toContain('trash-list');
    });
  });

  /*
    End-to-end check of the same wiring through real pointer events: the drop
    handler is only reached if the browser-level drag actually lands on the
    trash. A section without an enclosing drop list floats free instead and
    nothing is deleted.
   */
  describe('dragging a section onto the trash', () => {
    function center(el: Element): { x: number; y: number } {
      const rect = el.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    }

    /*
      CDK ignores a mousedown with `buttons: 0`, treating it as the synthetic
      event a screen reader fires on enter/space.
     */
    function dispatchMouse(target: EventTarget, type: string, x: number, y: number): void {
      target.dispatchEvent(
        new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          clientX: x,
          clientY: y,
          screenX: x,
          screenY: y,
          button: 0,
          buttons: 1,
          detail: 1,
        })
      );
    }

    async function dragSectionToTrash(sectionTitle: string): Promise<void> {
      const handle = fixture.debugElement
        .queryAll(By.css('.section-header'))
        .find((el) => el.nativeElement.textContent.includes(sectionTitle))!.nativeElement;
      const trash: HTMLElement = fixture.nativeElement.querySelector('.trash-icon');
      /*
        The karma viewport is narrow enough that a section card can overlap the
        floating trash. CDK only accepts a drop when elementFromPoint at the
        cursor resolves to the target list, so lift the trash above both the
        cards and CDK's own preview (z-index 1000) to keep the test about the
        drop wiring rather than about the test window's size.
       */
      trash.style.zIndex = '2147483647';

      const from = center(handle);
      const to = center(trash);

      dispatchMouse(handle, 'mousedown', from.x, from.y);
      fixture.detectChanges();
      /*
        Move in steps like a real pointer does. The first step passes the 5px
        pickup threshold and starts the drag; jumping straight to the trash
        leaves the preview lagging under the cursor, which blocks the drop.
       */
      const steps = 12;
      for (let step = 1; step <= steps; step++) {
        dispatchMouse(
          document,
          'mousemove',
          from.x + ((to.x - from.x) * step) / steps,
          from.y + ((to.y - from.y) * step) / steps
        );
      }
      dispatchMouse(document, 'mouseup', to.x, to.y);
      fixture.detectChanges();
      // The drop is emitted once the preview has animated back to the placeholder.
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    it('should delete the section', async () => {
      await dragSectionToTrash('Packing');

      expect(mockListService.removeSectionFromList).toHaveBeenCalledWith('list1', 's1');
    });

    it('should delete the ungrouped section', async () => {
      await dragSectionToTrash(UNGROUPED_SECTION_TITLE);

      expect(mockListService.removeSectionFromList).toHaveBeenCalledWith('list1', 'ungrouped');
    });
  });

  // --- ungrouped section ---

  it('should remove ungrouped section when dropped on trash', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'sections' },
      container: { id: 'trash' },
      item: { data: { type: 'section', id: 'ungrouped' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockListService.removeSectionFromList).toHaveBeenCalledWith('list1', 'ungrouped');
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
      const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
      dialogRef.afterClosed.and.returnValue(of(dialogResult([MOCK_GROUPS[0]])));
      spyOn(component.dialog, 'open').and.returnValue(dialogRef);

      component.openDialogAddGroup();

      expect(mockGroupService.getGroups).toHaveBeenCalled();
      done();
    });
  });

  // --- openDialogAddGroup ---

  it('should fetch groups, open dialog, and create sections for selected groups', () => {
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of(dialogResult([MOCK_GROUPS[1]])));
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
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(
      of(dialogResult([MOCK_GROUPS[0], MOCK_GROUPS[2]]))
    );
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
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of(dialogResult([MOCK_GROUPS[0]])));
    spyOn(component.dialog, 'open').and.returnValue(dialogRef);

    component.openDialogAddGroup();

    expect(mockListService.addSectionToList).not.toHaveBeenCalled();
  });

  // --- creating a section from a typed title (F01) ---

  describe('new section from the dialog title field', () => {
    function closeDialogWith(result: AddSectionsResult | undefined): void {
      const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
      dialogRef.afterClosed.and.returnValue(of(result));
      spyOn(component.dialog, 'open').and.returnValue(dialogRef);
      component.openDialogAddGroup();
    }

    it('should create an empty section with the typed title', () => {
      closeDialogWith(dialogResult([], 'Beach gear'));

      expect(mockListService.addEmptySectionToList).toHaveBeenCalledWith(
        'list1',
        'Beach gear'
      );
    });

    it('should trim whitespace from the typed title', () => {
      closeDialogWith(dialogResult([], '  Beach gear  '));

      expect(mockListService.addEmptySectionToList).toHaveBeenCalledWith(
        'list1',
        'Beach gear'
      );
    });

    it('should not create a section when the title is empty', () => {
      closeDialogWith(dialogResult([MOCK_GROUPS[0]], ''));

      expect(mockListService.addEmptySectionToList).not.toHaveBeenCalled();
    });

    it('should not create a section when the title is whitespace only', () => {
      closeDialogWith(dialogResult([], '   '));

      expect(mockListService.addEmptySectionToList).not.toHaveBeenCalled();
    });

    it('should not create a section when the dialog is cancelled', () => {
      closeDialogWith(undefined);

      expect(mockListService.addEmptySectionToList).not.toHaveBeenCalled();
    });

    it('should not create a section when list is undefined', () => {
      component.list = undefined;
      closeDialogWith(dialogResult([], 'Beach gear'));

      expect(mockListService.addEmptySectionToList).not.toHaveBeenCalled();
    });

    /*
      A typed title and ticked groups are independent: asking for both must
      produce both, and must not disturb the sections already on the list.
     */
    it('should create the typed section alongside the selected group sections', () => {
      const sectionsBefore = component.list!.sections.map((s) => ({
        ...s,
        items: [...s.items],
      }));

      closeDialogWith(dialogResult([MOCK_GROUPS[1]], 'Beach gear'));

      expect(mockListService.addEmptySectionToList).toHaveBeenCalledOnceWith(
        'list1',
        'Beach gear'
      );
      expect(mockListService.addSectionToList).toHaveBeenCalledOnceWith(
        'list1',
        MOCK_GROUPS[1]
      );
      expect(mockListService.removeSectionFromList).not.toHaveBeenCalled();
      expect(mockListService.updateSectionItems).not.toHaveBeenCalled();
      expect(component.list!.sections).toEqual(sectionsBefore);
    });
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

  it('should create a typed section on the shared node when the list is shared', () => {
    component.isShared = true;
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of(dialogResult([], 'Beach gear')));
    spyOn(component.dialog, 'open').and.returnValue(dialogRef);

    component.openDialogAddGroup();

    expect(mockListService.addEmptySharedSectionToList).toHaveBeenCalledWith(
      'list1',
      'Beach gear'
    );
    expect(mockListService.addEmptySectionToList).not.toHaveBeenCalled();
  });

  // --- route param handling ---

  it('should not call getList when route param id is null', async () => {
    mockListService.getList.calls.reset();

    await TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [ListComponent, MatDialogModule, MatListModule, MatIconModule, MatTooltipModule, DragDropModule],
      providers: [
        { provide: ListService, useValue: mockListService },
        { provide: GroupService, useValue: mockGroupService },
        { provide: AuthService, useValue: { user$: of(null) } },
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

  // --- formatSharedWith ---

  describe('formatSharedWith', () => {
    it('should format a single email', () => {
      expect(formatSharedWith(['bob@test.com'])).toBe(
        'Shared with: bob@test.com'
      );
    });

    it('should format two emails joined by "and"', () => {
      expect(formatSharedWith(['bob@test.com', 'ann@test.com'])).toBe(
        'Shared with: bob@test.com and ann@test.com'
      );
    });

    it('should format three or more emails with commas and "and" before the last', () => {
      expect(
        formatSharedWith(['bob@test.com', 'ann@test.com', 'marie@test.com'])
      ).toBe('Shared with: bob@test.com, ann@test.com and marie@test.com');
    });

    it('should return an empty string when there are no emails', () => {
      expect(formatSharedWith([])).toBe('');
    });
  });

  // --- shared-with info tooltip ---

  describe('shared-with info icon', () => {
    function setList(list: List): void {
      component.list = list;
      fixture.detectChanges();
    }

    it('should not show the info icon for a private, unshared list', () => {
      setList({ ...MOCK_LIST });

      const infoIcon = fixture.debugElement.query(By.css('.shared-with-info'));
      expect(infoIcon).toBeNull();
    });

    it('should show the info icon when the current user owns the shared list', () => {
      setList({
        ...MOCK_LIST,
        isShared: true,
        ownerUid: 'ownerUid',
        sharedWith: { friendUid: 'friend@test.com' },
      });

      const infoIcon = fixture.debugElement.query(By.css('.shared-with-info'));
      expect(infoIcon).toBeTruthy();
      const tooltip = infoIcon.injector.get(MatTooltip);
      expect(tooltip.message).toBe('Shared with: friend@test.com');
    });

    it('should not show the info icon when the current user is a recipient, not the owner', () => {
      setList({
        ...MOCK_LIST,
        isShared: true,
        ownerUid: 'someoneElseUid',
        sharedWith: { ownerUid: 'owner@test.com' },
      });

      const infoIcon = fixture.debugElement.query(By.css('.shared-with-info'));
      expect(infoIcon).toBeNull();
    });

    it('should not show the info icon when the shared list has no recipients yet', () => {
      setList({
        ...MOCK_LIST,
        isShared: true,
        ownerUid: 'ownerUid',
        sharedWith: {},
      });

      const infoIcon = fixture.debugElement.query(By.css('.shared-with-info'));
      expect(infoIcon).toBeNull();
    });
  });

  // --- share button visibility (owner-only sharing) ---

  describe('share button', () => {
    function setList(list: List): void {
      component.list = list;
      fixture.detectChanges();
    }

    function shareButton() {
      return fixture.debugElement.query(By.css('.share-list'));
    }

    it('should show the share button for a private list', () => {
      setList({ ...MOCK_LIST });

      expect(component.canShare).toBeTrue();
      expect(shareButton()).toBeTruthy();
    });

    it('should show the share button when the current user owns the shared list', () => {
      setList({
        ...MOCK_LIST,
        isShared: true,
        ownerUid: 'ownerUid',
        sharedWith: { friendUid: 'friend@test.com' },
      });

      expect(component.canShare).toBeTrue();
      expect(shareButton()).toBeTruthy();
    });

    it('should hide the share button from a recipient of a shared list', () => {
      setList({
        ...MOCK_LIST,
        isShared: true,
        ownerUid: 'someoneElseUid',
        sharedWith: { ownerUid: 'owner@test.com' },
      });

      expect(component.canShare).toBeFalse();
      expect(shareButton()).toBeNull();
    });
  });

  // --- collapse / expand all sections ---

  describe('collapse/expand all sections', () => {
    function toggleButton() {
      return fixture.debugElement.query(By.css('.toggle-sections'));
    }

    function toggleIconName(): string {
      return toggleButton().query(By.css('mat-icon')).nativeElement.textContent.trim();
    }

    function sectionItems() {
      return fixture.debugElement.queryAll(By.css('mat-list-item'));
    }

    function addItemRows() {
      return fixture.debugElement.queryAll(By.css('.add-item-row'));
    }

    function sectionHeaders() {
      return fixture.debugElement.queryAll(By.css('.section-header'));
    }

    function clickToggle(): void {
      toggleButton().nativeElement.click();
      fixture.detectChanges();
    }

    it('should start with the sections expanded', () => {
      expect(component.sectionsCollapsed).toBeFalse();
      expect(sectionItems().length).toBe(4);
      expect(addItemRows().length).toBe(3);
    });

    it('should show the collapse icon while the sections are expanded', () => {
      expect(toggleIconName()).toBe('unfold_less');
    });

    it('should sit between the share and add buttons', () => {
      const buttons = fixture.debugElement
        .queryAll(By.css('.button-row button'))
        .map((el) => el.query(By.css('mat-icon')).nativeElement.textContent.trim());

      expect(buttons).toEqual(['share', 'unfold_less', 'add']);
    });

    it('should collapse every section when clicked while expanded', () => {
      clickToggle();

      expect(component.sectionsCollapsed).toBeTrue();
      expect(sectionItems().length).toBe(0);
      expect(addItemRows().length).toBe(0);
    });

    it('should keep the section titles visible while collapsed', () => {
      clickToggle();

      const titles = sectionHeaders().map((el) =>
        el.query(By.css('.section-title-text')).nativeElement.textContent.trim()
      );
      expect(titles).toEqual([UNGROUPED_SECTION_TITLE, 'Packing', 'Electronics']);
    });

    it('should show the expand icon while the sections are collapsed', () => {
      clickToggle();

      expect(toggleIconName()).toBe('unfold_more');
    });

    it('should expand every section when clicked while collapsed', () => {
      clickToggle();
      clickToggle();

      expect(component.sectionsCollapsed).toBeFalse();
      expect(sectionItems().length).toBe(4);
      expect(addItemRows().length).toBe(3);
      expect(toggleIconName()).toBe('unfold_less');
    });

    it('should not write the collapsed state to the backend', () => {
      clickToggle();

      expect(mockListService.updateSectionItems).not.toHaveBeenCalled();
      expect(mockListService.updateSharedSectionItems).not.toHaveBeenCalled();
    });
  });

  // --- renaming a section (F05) ---

  describe('renaming a section', () => {
    function titleOf(sectionTitle: string) {
      return fixture.debugElement
        .queryAll(By.css('.section-header h2'))
        .find(
          (el) =>
            el.query(By.css('.section-title-text')).nativeElement.textContent.trim() ===
            sectionTitle
        )!;
    }

    function stubDialog(closesWith: string | undefined) {
      const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
      dialogRef.afterClosed.and.returnValue(of(closesWith));
      return spyOn(component.dialog, 'open').and.returnValue(dialogRef);
    }

    /*
      A click carries only the position it was released at, so the press has to
      be recorded first. Same coordinates means the pointer never moved: a tap.
     */
    function pressAndClick(sectionTitle: string, movedBy = 0): void {
      const title = titleOf(sectionTitle);
      title.triggerEventHandler('mousedown', { clientX: 100, clientY: 100 });
      title.triggerEventHandler('click', {
        clientX: 100 + movedBy,
        clientY: 100,
      });
    }

    it('should show a rename hint on every section', () => {
      const hintOwners = fixture.debugElement
        .queryAll(By.css('.section-header h2'))
        .filter((el) => el.query(By.css('.rename-hint')))
        .map((el) => el.query(By.css('.section-title-text')).nativeElement.textContent.trim());

      expect(hintOwners).toEqual([UNGROUPED_SECTION_TITLE, 'Packing', 'Electronics']);
    });

    /*
      The pill is the tap target, not the glyph, so it has to announce itself as
      a control.
     */
    it('should expose a title as a keyboard-reachable button', () => {
      const title = titleOf('Packing').nativeElement as HTMLElement;

      expect(title.getAttribute('role')).toBe('button');
      expect(title.getAttribute('tabindex')).toBe('0');
      expect(title.getAttribute('aria-label')).toBe('Rename section Packing');
    });

    it('should open the dialog prefilled with the current title when tapped', () => {
      const open = stubDialog(undefined);

      pressAndClick('Packing');

      expect(open).toHaveBeenCalledWith(
        DialogRenameComponent,
        jasmine.objectContaining({
          data: { entity: 'section', title: 'Packing' },
        })
      );
    });

    it('should rename the section with the title the dialog returns', () => {
      stubDialog('Hand luggage');

      pressAndClick('Packing');

      expect(mockListService.renameSection).toHaveBeenCalledWith(
        'list1',
        's1',
        'Hand luggage'
      );
    });

    it('should write nothing when the dialog is dismissed', () => {
      stubDialog(undefined);

      pressAndClick('Packing');

      expect(mockListService.renameSection).not.toHaveBeenCalled();
    });

    it('should not touch any other section', () => {
      stubDialog('Hand luggage');

      pressAndClick('Packing');

      expect(mockListService.renameSection).toHaveBeenCalledTimes(1);
      expect(mockListService.updateSectionItems).not.toHaveBeenCalled();
      expect(mockListService.removeSectionFromList).not.toHaveBeenCalled();
    });

    /*
      Ungrouped is an ordinary section since it became deletable, so it renames
      like the rest rather than being singled out.
     */
    it('should rename the Ungrouped section like any other', () => {
      stubDialog('Odds and ends');

      pressAndClick(UNGROUPED_SECTION_TITLE);

      expect(mockListService.renameSection).toHaveBeenCalledWith(
        'list1',
        'ungrouped',
        'Odds and ends'
      );
    });

    it('should not open the dialog when the list is undefined', () => {
      const open = stubDialog('Hand luggage');
      component.list = undefined;

      component.openRenameDialog(MOCK_SECTIONS[1]);

      expect(open).not.toHaveBeenCalled();
    });

    /*
      CDK does not suppress the click that follows a mouse drag, so without the
      movement check a section dragged a few pixels — or all the way to the
      trash — would also open the rename dialog on release.
     */
    it('should ignore a click that ends away from where the press began', () => {
      const open = stubDialog('Hand luggage');

      pressAndClick('Packing', TAP_MOVE_TOLERANCE_PX + 1);

      expect(open).not.toHaveBeenCalled();
      expect(mockListService.renameSection).not.toHaveBeenCalled();
    });

    it('should still rename when the pointer only wobbled within the tolerance', () => {
      stubDialog('Hand luggage');

      pressAndClick('Packing', TAP_MOVE_TOLERANCE_PX);

      expect(mockListService.renameSection).toHaveBeenCalled();
    });

    /*
      The recorded press is consumed by the click it belongs to. Otherwise it
      would keep vouching for clicks that follow, including the one at the end of
      a later drag.
     */
    it('should require its own press for every click', () => {
      const open = stubDialog('Hand luggage');
      const title = titleOf('Packing');

      title.triggerEventHandler('mousedown', { clientX: 100, clientY: 100 });
      title.triggerEventHandler('click', { clientX: 100, clientY: 100 });
      title.triggerEventHandler('click', { clientX: 400, clientY: 400 });

      expect(open).toHaveBeenCalledTimes(1);
    });

    it('should rename via the keyboard without any press recorded', () => {
      stubDialog('Hand luggage');

      titleOf('Packing').triggerEventHandler('keyup.enter', {});

      expect(mockListService.renameSection).toHaveBeenCalledWith(
        'list1',
        's1',
        'Hand luggage'
      );
    });

    it('should rename on the shared node when the list is shared', () => {
      component.isShared = true;
      stubDialog('Hand luggage');

      pressAndClick('Packing');

      expect(mockListService.renameSharedSection).toHaveBeenCalledWith(
        'list1',
        's1',
        'Hand luggage'
      );
      expect(mockListService.renameSection).not.toHaveBeenCalled();
    });
  });
});
