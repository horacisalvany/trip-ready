import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { ListsComponent } from './lists.component';
import { AuthService } from '../../services/auth.service';
import { ListService } from '../list/list.service';
import { ShareService } from '../../services/share.service';
import { List } from './list';
import { expectAllDragsHaveStartDelay } from '../drag-config.spec-helper';

const MOCK_LISTS: List[] = [
  { id: 'l1', title: 'Paris Trip', sections: [] },
  { id: 'l2', title: 'Weekend Getaway', sections: [] },
];

describe('ListsComponent', () => {
  let component: ListsComponent;
  let fixture: ComponentFixture<ListsComponent>;
  let mockListService: jasmine.SpyObj<ListService>;
  let mockShareService: jasmine.SpyObj<ShareService>;
  let mockAuthService: any;
  let snackBar: MatSnackBar;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockListService = jasmine.createSpyObj('ListService', [
      'getLists',
      'addList',
      'deleteList',
    ]);
    mockListService.getLists.and.returnValue(
      of(MOCK_LISTS.map((l) => ({ ...l })))
    );
    mockListService.addList.and.returnValue(of('newKey'));
    mockListService.deleteList.and.returnValue(of(undefined));

    mockShareService = jasmine.createSpyObj('ShareService', ['getSharedLists', 'deleteSharedList']);
    mockShareService.getSharedLists.and.returnValue(of([]));
    mockShareService.deleteSharedList.and.returnValue(of(undefined));

    mockAuthService = {
      user$: of({ uid: 'currentUid', email: 'me@test.com' }),
    };

    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [
        ListsComponent,
        MatDialogModule,
        MatListModule,
        MatIconModule,
        DragDropModule,
        NoopAnimationsModule,
      ],
      providers: [
        { provide: ListService, useValue: mockListService },
        { provide: ShareService, useValue: mockShareService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        {
          provide: ActivatedRoute,
          useValue: {
            params: of({ id: '123' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ListsComponent);
    component = fixture.componentInstance;
    snackBar = (component as any).snackBar;
    spyOn(snackBar, 'open');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // --- ngOnInit / loading ---

  it('should load lists on init', () => {
    expect(mockListService.getLists).toHaveBeenCalled();
    expect(component.lists.length).toBe(2);
    expect(component.lists[0].title).toBe('Paris Trip');
  });

  // --- onClickList ---

  it('should navigate to the list detail view', () => {
    component.onClickList('l1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['l1'],
      jasmine.any(Object)
    );
  });

  // --- dropTrash ---

  it('should delete the list when dropped on trash', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'lists-container' },
      container: { id: 'trash' },
      item: { data: 'l1' },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockListService.deleteList).toHaveBeenCalledWith('l1');
  });

  it('should not delete when drag data is empty', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'lists-container' },
      container: { id: 'trash' },
      item: { data: '' },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockListService.deleteList).not.toHaveBeenCalled();
  });

  // --- dropList ---

  it('should not throw when a list item is dropped back into the list', () => {
    const event = {
      previousIndex: 0,
      currentIndex: 1,
    } as unknown as CdkDragDrop<any>;

    expect(() => component.dropList(event)).not.toThrow();
  });

  // --- openDialogAddList ---

  it('should open dialog and create list on confirm', () => {
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of('Beach Holiday'));
    spyOn(component.dialog, 'open').and.returnValue(dialogRef);

    component.openDialogAddList();

    expect(component.dialog.open).toHaveBeenCalled();
    expect(mockListService.addList).toHaveBeenCalledWith('Beach Holiday');
  });

  it('should not create list when dialog is cancelled', () => {
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of(undefined));
    spyOn(component.dialog, 'open').and.returnValue(dialogRef);

    component.openDialogAddList();

    expect(component.dialog.open).toHaveBeenCalled();
    expect(mockListService.addList).not.toHaveBeenCalled();
  });

  // --- shared lists ---

  it('should load shared lists on init', () => {
    expect(mockShareService.getSharedLists).toHaveBeenCalled();
  });

  it('should display shared lists when present', () => {
    const sharedLists = [
      { id: 'sl1', title: 'Shared Trip', sections: [], ownerEmail: 'friend@test.com', isShared: true },
    ];
    mockShareService.getSharedLists.and.returnValue(of(sharedLists as any));
    component.ngOnInit();
    expect(component.sharedLists.length).toBe(1);
    expect(component.sharedLists[0].title).toBe('Shared Trip');
  });

  it('should filter out private lists that duplicate a shared list', () => {
    const privateLists = [
      { id: 'l1', title: 'Paris Trip', sections: [] },
      { id: 'shared-id', title: 'Ghost List', sections: [] },
    ];
    const sharedLists = [
      { id: 'shared-id', title: 'Real Shared List', sections: [], ownerEmail: 'friend@test.com', isShared: true },
    ];
    mockListService.getLists.and.returnValue(of(privateLists as any));
    mockShareService.getSharedLists.and.returnValue(of(sharedLists as any));
    component.ngOnInit();
    expect(component.lists.length).toBe(1);
    expect(component.lists[0].title).toBe('Paris Trip');
    expect(component.sharedLists.length).toBe(1);
    expect(component.sharedLists[0].title).toBe('Real Shared List');
  });

  it('should navigate to shared list with shared prefix', () => {
    component.onClickSharedList('sl1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['shared', 'sl1'],
      jasmine.any(Object)
    );
  });

  // --- dropTrash shared lists ---

  it('should delete shared list when owner drags to trash', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'shared-lists' },
      container: { id: 'trash' },
      item: { data: { type: 'shared', id: 'sl1', ownerUid: 'currentUid' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockShareService.deleteSharedList).toHaveBeenCalledWith('sl1');
  });

  it('should show snackbar and not delete when non-owner drags shared list to trash', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'shared-lists' },
      container: { id: 'trash' },
      item: { data: { type: 'shared', id: 'sl1', ownerUid: 'someoneElse' } },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockShareService.deleteSharedList).not.toHaveBeenCalled();
    expect(snackBar.open).toHaveBeenCalledWith(
      'Only the list creator can delete a shared list',
      'OK',
      jasmine.any(Object)
    );
  });

  it('should not delete when drag data is null', () => {
    const event = {
      previousIndex: 0,
      previousContainer: { id: 'lists-container' },
      container: { id: 'trash' },
      item: { data: null },
    } as unknown as CdkDragDrop<any>;

    component.dropTrash(event);

    expect(mockListService.deleteList).not.toHaveBeenCalled();
    expect(mockShareService.deleteSharedList).not.toHaveBeenCalled();
  });

  // --- touch drag delay (mobile scrolling) ---

  it('should apply the shared touch drag delay to private list cards', () => {
    expectAllDragsHaveStartDelay(fixture, 2);
  });

  it('should apply the shared touch drag delay to shared list cards', () => {
    component.sharedLists = [
      {
        id: 's1',
        title: 'Shared Trip',
        sections: [],
        ownerUid: 'otherUid',
        ownerEmail: 'other@test.com',
      },
    ];
    fixture.detectChanges();

    // 2 private lists + 1 shared list
    expectAllDragsHaveStartDelay(fixture, 3);
  });
});
