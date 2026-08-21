import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { of } from 'rxjs';
import { GroupComponent } from './group.component';
import { GroupService } from './group.service';
import { Group } from './group';
import { expectAllDragsHaveStartDelay } from '../drag-config.spec-helper';

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
    ]);
    mockGroupService.getGroups.and.returnValue(
      of(MOCK_GROUPS.map((g) => ({ ...g, items: [...g.items] })))
    );
    mockGroupService.updateGroup.and.returnValue(of(undefined));
    mockGroupService.addGroup.and.returnValue(of('newKey'));
    mockGroupService.deleteGroup.and.returnValue(of(undefined));

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

  // --- touch drag delay (mobile scrolling) ---

  it('should apply the shared touch drag delay to every draggable', () => {
    // 2 group cards + 4 items (2 in Packing + 2 in Documents)
    expectAllDragsHaveStartDelay(fixture, 6);
  });
});
