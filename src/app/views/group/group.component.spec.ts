import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { of } from 'rxjs';
import { GroupComponent } from './group.component';
import { GroupService } from './group.service';
import { Group } from './group';
import { DialogRenameComponent } from '../dialog-rename/dialog-rename.component';
import { expectAllDragsHaveStartDelay } from '../drag-config.spec-helper';
import { TAP_MOVE_TOLERANCE_PX } from '../tap-guard';

const MOCK_GROUPS: Group[] = [
  { id: 'g1', title: 'Packing', items: ['Passport', 'Tickets'] },
  { id: 'g2', title: 'Documents', items: ['ID Card', 'Insurance'] },
];

describe('GroupComponent', () => {
  let component: GroupComponent;
  let fixture: ComponentFixture<GroupComponent>;
  let mockGroupService: jasmine.SpyObj<GroupService>;
  let mockDialog: jasmine.SpyObj<MatDialog>;

  beforeEach(async () => {
    mockGroupService = jasmine.createSpyObj('GroupService', [
      'getGroups',
      'updateGroup',
      'addGroup',
      'deleteGroup',
      'renameGroup',
    ]);
    mockGroupService.getGroups.and.returnValue(
      of(MOCK_GROUPS.map((g) => ({ ...g, items: [...g.items] })))
    );
    mockGroupService.updateGroup.and.returnValue(of(undefined));
    mockGroupService.addGroup.and.returnValue(of('newKey'));
    mockGroupService.deleteGroup.and.returnValue(of(undefined));
    mockGroupService.renameGroup.and.returnValue(of(undefined));

    mockDialog = jasmine.createSpyObj('MatDialog', ['open']);

    await TestBed.configureTestingModule({
      imports: [MatDialogModule, MatIconModule, DragDropModule],
      declarations: [GroupComponent],
      providers: [
        { provide: GroupService, useValue: mockGroupService },
        { provide: MatDialog, useValue: mockDialog },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(GroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- loadgroups ---

  it('should load groups on init', () => {
    expect(mockGroupService.getGroups).toHaveBeenCalled();
    expect(component.groups.length).toBe(2);
    expect(component.groups[0].title).toBe('Packing');
    expect(component.groups[1].title).toBe('Documents');
  });

  // --- onAdd ---

  it('should add an item to the group and update Firebase', () => {
    const input = { value: 'Sunglasses' } as HTMLInputElement;
    component.onAdd(0, input);

    expect(component.groups[0].items).toContain('Sunglasses');
    expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
      'g1',
      component.groups[0].items
    );
  });

  it('should not add empty or whitespace-only items', () => {
    const input = { value: '   ' } as HTMLInputElement;
    component.onAdd(0, input);

    expect(mockGroupService.updateGroup).not.toHaveBeenCalled();
  });

  // --- onDelete ---

  it('should delete an item from the group and update Firebase', () => {
    component.onDelete(0, 0);

    expect(component.groups[0].items).not.toContain('Passport');
    expect(component.groups[0].items.length).toBe(1);
    expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
      'g1',
      component.groups[0].items
    );
  });

  // --- updateFirebase ---

  it('should call groupService.updateGroup', () => {
    component.updateFirebase('g1', ['item1']);
    expect(mockGroupService.updateGroup).toHaveBeenCalledWith('g1', ['item1']);
  });

  // --- drop (same container) ---

  it('should reorder items within the same group on drop', () => {
    const containerData = component.groups[0].items;
    const container = {
      id: 'cdk-drop-list-g1',
      data: containerData,
    };
    const event = {
      previousIndex: 0,
      currentIndex: 1,
      previousContainer: container,
      container: container,
      item: { data: { type: 'item' } },
    } as unknown as CdkDragDrop<string[]>;

    component.drop(event);

    expect(component.groups[0].items[0]).toBe('Tickets');
    expect(component.groups[0].items[1]).toBe('Passport');
    expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
      'g1',
      component.groups[0].items
    );
  });

  // --- drop (different containers) ---

  it('should transfer items between groups on drop', () => {
    const sourceData = component.groups[0].items;
    const targetData = component.groups[1].items;
    const previousContainer = {
      id: 'cdk-drop-list-g1',
      data: sourceData,
    };
    const targetContainer = {
      id: 'cdk-drop-list-g2',
      data: targetData,
    };
    const event = {
      previousIndex: 0,
      currentIndex: 0,
      previousContainer: previousContainer,
      container: targetContainer,
      item: { data: { type: 'item' } },
    } as unknown as CdkDragDrop<string[]>;

    component.drop(event);

    expect(component.groups[0].items).not.toContain('Passport');
    expect(component.groups[1].items).toContain('Passport');
    expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
      'g1',
      component.groups[0].items
    );
    expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
      'g2',
      component.groups[1].items
    );
  });

  // --- dropTrash (item) ---

  it('should delete an item when dropped on trash', () => {
    const sourceData = component.groups[0].items;
    const event = {
      previousIndex: 0,
      previousContainer: {
        id: 'cdk-drop-list-g1',
        data: sourceData,
      },
      container: { id: 'trash' },
      item: { data: { type: 'item' } },
    } as unknown as CdkDragDrop<string[]>;

    component.dropTrash(event);

    expect(component.groups[0].items).not.toContain('Passport');
    expect(component.groups[0].items.length).toBe(1);
    expect(mockGroupService.updateGroup).toHaveBeenCalledWith(
      'g1',
      component.groups[0].items
    );
  });

  // --- dropTrash (group card) ---

  it('should delete a group when a group card is dropped on trash', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'group-cards' },
      container: { id: 'trash' },
      item: { data: { type: 'group', id: 'g1' } },
    } as unknown as CdkDragDrop<string[]>;

    component.dropTrash(event);

    expect(mockGroupService.deleteGroup).toHaveBeenCalledWith('g1');
    expect(mockGroupService.updateGroup).not.toHaveBeenCalled();
  });

  // --- dropGroupCard ---

  it('should not throw when a group card is dropped back into the list', () => {
    const event = {
      previousIndex: 0,
      currentIndex: 1,
    } as unknown as CdkDragDrop<any[]>;

    expect(() => component.dropGroupCard(event)).not.toThrow();
  });

  // --- predicates ---

  it('groupCardPredicate should accept group drags', () => {
    const drag = { data: { type: 'group', id: 'g1' } } as any;
    expect(component.groupCardPredicate(drag)).toBeTrue();
  });

  it('groupCardPredicate should reject item drags', () => {
    const drag = { data: { type: 'item' } } as any;
    expect(component.groupCardPredicate(drag)).toBeFalse();
  });

  it('itemPredicate should accept item drags', () => {
    const drag = { data: { type: 'item' } } as any;
    expect(component.itemPredicate(drag)).toBeTrue();
  });

  it('itemPredicate should reject group drags', () => {
    const drag = { data: { type: 'group', id: 'g1' } } as any;
    expect(component.itemPredicate(drag)).toBeFalse();
  });

  // --- openDialogAddGroup ---

  // --- recentlyDropped guard ---

  it('should not open dialog if called right after dropTrash', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'group-cards' },
      container: { id: 'trash' },
      item: { data: { type: 'group', id: 'g1' } },
    } as unknown as CdkDragDrop<string[]>;

    component.dropTrash(event);
    component.openDialogAddGroup();

    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('should not open dialog if called right after dropGroupCard', () => {
    const event = {
      previousIndex: 0,
      currentIndex: 1,
    } as unknown as CdkDragDrop<any[]>;

    component.dropGroupCard(event);
    component.openDialogAddGroup();

    expect(mockDialog.open).not.toHaveBeenCalled();
  });

  it('should open dialog again after recentlyDropped flag resets', (done) => {
    const trashEvent = {
      previousIndex: 0,
      previousContainer: { id: 'group-cards' },
      container: { id: 'trash' },
      item: { data: { type: 'group', id: 'g1' } },
    } as unknown as CdkDragDrop<string[]>;

    component.dropTrash(trashEvent);

    setTimeout(() => {
      const dialogRef = {
        afterClosed: () => of('New Group'),
      } as MatDialogRef<any>;
      mockDialog.open.and.returnValue(dialogRef);

      component.openDialogAddGroup();

      expect(mockDialog.open).toHaveBeenCalled();
      done();
    });
  });

  it('should open dialog and call addGroup when title is returned', () => {
    const dialogRef = {
      afterClosed: () => of('New Group'),
    } as MatDialogRef<any>;
    mockDialog.open.and.returnValue(dialogRef);

    component.openDialogAddGroup();

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockGroupService.addGroup).toHaveBeenCalledWith('New Group');
  });

  it('should open dialog and not call addGroup when dialog is cancelled', () => {
    const dialogRef = {
      afterClosed: () => of(undefined),
    } as MatDialogRef<any>;
    mockDialog.open.and.returnValue(dialogRef);

    component.openDialogAddGroup();

    expect(mockDialog.open).toHaveBeenCalled();
    expect(mockGroupService.addGroup).not.toHaveBeenCalled();
  });

  // --- renaming a group (F06) ---

  describe('renaming a group', () => {
    function titleOf(groupTitle: string) {
      return fixture.debugElement
        .queryAll(By.css('.group-header h2'))
        .find(
          (el) =>
            el
              .query(By.css('.group-title-text'))
              .nativeElement.textContent.trim() === groupTitle
        )!;
    }

    function stubDialog(closesWith: string | undefined): void {
      mockDialog.open.and.returnValue({
        afterClosed: () => of(closesWith),
      } as MatDialogRef<any>);
    }

    /*
      A click carries only the position it was released at, so the press has to
      be recorded first. Same coordinates means the pointer never moved: a tap.
     */
    function pressAndClick(groupTitle: string, movedBy = 0): void {
      const title = titleOf(groupTitle);
      title.triggerEventHandler('mousedown', { clientX: 100, clientY: 100 });
      title.triggerEventHandler('click', {
        clientX: 100 + movedBy,
        clientY: 100,
      });
    }

    it('should show a rename hint on every group', () => {
      const hintOwners = fixture.debugElement
        .queryAll(By.css('.group-header h2'))
        .filter((el) => el.query(By.css('.rename-hint')))
        .map((el) =>
          el.query(By.css('.group-title-text')).nativeElement.textContent.trim()
        );

      expect(hintOwners).toEqual(['Packing', 'Documents']);
    });

    /*
      The pill is the tap target, not the glyph, so it has to announce itself as
      a control.
     */
    it('should expose a title as a keyboard-reachable button', () => {
      const title = titleOf('Packing').nativeElement as HTMLElement;

      expect(title.getAttribute('role')).toBe('button');
      expect(title.getAttribute('tabindex')).toBe('0');
      expect(title.getAttribute('aria-label')).toBe('Rename group Packing');
    });

    it('should open the shared rename dialog prefilled with the current title', () => {
      stubDialog(undefined);

      pressAndClick('Packing');

      expect(mockDialog.open).toHaveBeenCalledWith(
        DialogRenameComponent,
        jasmine.objectContaining({
          data: { entity: 'group', title: 'Packing' },
        })
      );
    });

    it('should rename the group with the title the dialog returns', () => {
      stubDialog('Hand luggage');

      pressAndClick('Packing');

      expect(mockGroupService.renameGroup).toHaveBeenCalledWith(
        'g1',
        'Hand luggage'
      );
    });

    it('should write nothing when the dialog is dismissed', () => {
      stubDialog(undefined);

      pressAndClick('Packing');

      expect(mockGroupService.renameGroup).not.toHaveBeenCalled();
    });

    it('should rename the group that was tapped and no other', () => {
      stubDialog('Papers');

      pressAndClick('Documents');

      expect(mockGroupService.renameGroup).toHaveBeenCalledOnceWith(
        'g2',
        'Papers'
      );
    });

    /*
      The rename must not disturb the items: they are never rewritten, the view
      refreshes from the live groups stream.
     */
    it('should keep the items of the renamed group untouched', () => {
      stubDialog('Hand luggage');

      pressAndClick('Packing');

      expect(mockGroupService.updateGroup).not.toHaveBeenCalled();
      expect(component.groups[0].items).toEqual(['Passport', 'Tickets']);
    });

    /*
      CDK does not suppress the click that follows a mouse drag, so without the
      movement check a group dragged a few pixels — or all the way to the trash —
      would also open the rename dialog on release.
     */
    it('should ignore a click that ends away from where the press began', () => {
      stubDialog('Hand luggage');

      pressAndClick('Packing', TAP_MOVE_TOLERANCE_PX + 1);

      expect(mockDialog.open).not.toHaveBeenCalled();
      expect(mockGroupService.renameGroup).not.toHaveBeenCalled();
    });

    it('should still rename when the pointer only wobbled within the tolerance', () => {
      stubDialog('Hand luggage');

      pressAndClick('Packing', TAP_MOVE_TOLERANCE_PX);

      expect(mockGroupService.renameGroup).toHaveBeenCalled();
    });

    /*
      The recorded press is consumed by the click it belongs to. Otherwise it
      would keep vouching for clicks that follow, including the one at the end of
      a later drag.
     */
    it('should require its own press for every click', () => {
      stubDialog('Hand luggage');
      const title = titleOf('Packing');

      title.triggerEventHandler('mousedown', { clientX: 100, clientY: 100 });
      title.triggerEventHandler('click', { clientX: 100, clientY: 100 });
      title.triggerEventHandler('click', { clientX: 400, clientY: 400 });

      expect(mockDialog.open).toHaveBeenCalledTimes(1);
    });

    it('should rename via the keyboard without any press recorded', () => {
      stubDialog('Hand luggage');

      titleOf('Packing').triggerEventHandler('keyup.enter', {});

      expect(mockGroupService.renameGroup).toHaveBeenCalledWith(
        'g1',
        'Hand luggage'
      );
    });
  });

  // --- collapse / expand all groups (F07) ---

  describe('collapse/expand all groups', () => {
    function toggleButton() {
      return fixture.debugElement.query(By.css('.toggle-groups'));
    }

    function toggleIconName(): string {
      return toggleButton()
        .query(By.css('mat-icon'))
        .nativeElement.textContent.trim();
    }

    function groupItems() {
      return fixture.debugElement.queryAll(By.css('mat-list-item'));
    }

    function addItemRows() {
      return fixture.debugElement.queryAll(By.css('.add-item-row'));
    }

    function groupTitles(): string[] {
      return fixture.debugElement
        .queryAll(By.css('.group-header .group-title-text'))
        .map((el) => el.nativeElement.textContent.trim());
    }

    function clickToggle(): void {
      toggleButton().nativeElement.click();
      fixture.detectChanges();
    }

    it('should start with the groups expanded', () => {
      expect(component.groupsCollapsed).toBeFalse();
      expect(groupItems().length).toBe(4);
      expect(addItemRows().length).toBe(2);
    });

    it('should show the collapse icon while the groups are expanded', () => {
      expect(toggleIconName()).toBe('unfold_less');
    });

    /*
      The groups view has no share button, so "between share and add" (F07) means
      immediately before the `+`.
     */
    it('should sit before the add button', () => {
      const buttons = fixture.debugElement
        .queryAll(By.css('.button-row button'))
        .map((el) =>
          el.query(By.css('mat-icon')).nativeElement.textContent.trim()
        );

      expect(buttons).toEqual(['unfold_less', 'add']);
    });

    it('should collapse every group when clicked while expanded', () => {
      clickToggle();

      expect(component.groupsCollapsed).toBeTrue();
      expect(groupItems().length).toBe(0);
      expect(addItemRows().length).toBe(0);
    });

    it('should keep the group titles visible while collapsed', () => {
      clickToggle();

      expect(groupTitles()).toEqual(['Packing', 'Documents']);
    });

    it('should show the expand icon while the groups are collapsed', () => {
      clickToggle();

      expect(toggleIconName()).toBe('unfold_more');
    });

    it('should expand every group when clicked while collapsed', () => {
      clickToggle();
      clickToggle();

      expect(component.groupsCollapsed).toBeFalse();
      expect(groupItems().length).toBe(4);
      expect(addItemRows().length).toBe(2);
      expect(toggleIconName()).toBe('unfold_less');
    });

    it('should not write the collapsed state to the backend', () => {
      clickToggle();

      expect(mockGroupService.updateGroup).not.toHaveBeenCalled();
      expect(mockGroupService.renameGroup).not.toHaveBeenCalled();
    });

    /*
      Collapsed group cards stay draggable to the trash, so only the item drags
      disappear with the hidden lists.
     */
    it('should keep the group cards draggable while collapsed', () => {
      clickToggle();

      expect(fixture.debugElement.queryAll(By.css('.cdk-drag')).length).toBe(2);
    });
  });

  // --- touch drag delay (mobile scrolling) ---

  it('should apply the shared touch drag delay to every draggable', () => {
    // 2 group cards + 4 items (2 in Packing + 2 in Documents)
    expectAllDragsHaveStartDelay(fixture, 6);
  });

  it('should suppress text selection on every draggable so a long press does not select text', () => {
    // 2 group cards + 4 items (2 in Packing + 2 in Documents)
    const dragElements = fixture.debugElement.queryAll(By.css('.cdk-drag'));
    expect(dragElements.length).toBe(6);

    dragElements.forEach((el, i) =>
      expect(getComputedStyle(el.nativeElement).userSelect)
        .withContext(`.cdk-drag #${i} — rule lives in src/styles.scss, class is CDK's DRAG_HOST_CLASS`)
        .toBe('none')
    );
  });

  it('should keep text editing enabled on inputs inside a draggable', () => {
    const input = fixture.debugElement.query(By.css('.cdk-drag input'));
    expect(input).toBeTruthy();
    expect(getComputedStyle(input.nativeElement).userSelect)
      .withContext('rule lives in src/styles.scss')
      .toBe('text');
  });
});
