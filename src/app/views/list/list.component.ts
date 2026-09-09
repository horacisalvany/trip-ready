import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { take } from 'rxjs/operators';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from '../../services/auth.service';
import { GroupService } from '../group/group.service';
import { List } from '../lists/list';
import {
  AddSectionsResult,
  DialogAddGroupComponent,
} from './dialog-add-group/dialog-add-group.component';
import {
  ConfirmDialogData,
  DialogConfirmComponent,
} from '../dialog-confirm/dialog-confirm.component';
import {
  DialogRenameComponent,
  RenameDialogData,
} from '../dialog-rename/dialog-rename.component';
import { DialogShareListComponent } from './dialog-share-list/dialog-share-list.component';
import { Item } from './item';
import { ListService } from './list.service';
import { Section } from './section';
import { DRAG_START_DELAY } from '../drag-config';
import { TapGuard } from '../tap-guard';
import { trackById, trackByIndex } from '../track-by';
import { keepInView } from '../keep-in-view';

export function formatSharedWith(emails: string[]): string {
  if (emails.length === 0) return '';
  if (emails.length === 1) return `Shared with: ${emails[0]}`;
  const last = emails[emails.length - 1];
  const rest = emails.slice(0, -1);
  return `Shared with: ${rest.join(', ')} and ${last}`;
}

@Component({
  selector: 'list',
  templateUrl: './list.component.html',
  styleUrls: ['./list.component.scss'],
  standalone: true,
  imports: [CommonModule, MaterialModule, DragDropModule],
})
export class ListComponent implements OnInit {
  list: List | undefined;
  isShared = false;
  /*
    Purely a view preference, so it lives in the component and is not persisted:
    reopening the list shows every section expanded again.
   */
  sectionsCollapsed = false;
  /*
    Also a view preference — the marks are persisted, the mode is not, so a list
    always opens ready to read rather than ready to be tapped.
   */
  checklistMode = false;
  readonly dragStartDelay = DRAG_START_DELAY;
  /*
    Without these, every section card — and the "New item..." input inside it —
    is rebuilt on each emission, throwing away half-typed text. See track-by.ts.
   */
  readonly trackBySectionId = trackById;
  readonly trackByItemIndex = trackByIndex;
  currentUserUid: string | null = null;
  /*
    Boolean to control that something has been dropped. Without there are bugs like missclicks after you drop a list on the trash
    and the popup of add a new list is opened for no reason.
   */
  private recentlyDropped = false;
  /*
    Tells a tap on a section title from the click that ends a drag of its header.
   */
  private readonly titleTap = new TapGuard();
  /*
    Tells a tap on an item from the click that ends a drag of it. Items are
    draggable, so without this a drop would flip whatever it landed on.
   */
  private readonly itemTap = new TapGuard();
  /*
    The "New item..." row last typed into. An add writes to Firebase and waits
    for the stream to re-emit, so the new item — and the shove it gives this row
    — arrives later than the add itself. Held here until that emission, then
    scrolled back into view.
   */
  private pendingItemRow: HTMLElement | null = null;

  constructor(
    private route: ActivatedRoute,
    public dialog: MatDialog,
    private listService: ListService,
    private groupService: GroupService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe((user) => {
      this.currentUserUid = user?.uid ?? null;
    });

    this.route.data.subscribe((data) => {
      this.isShared = !!data['shared'];
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        const listObs = this.isShared
          ? this.listService.getSharedList(id)
          : this.listService.getList(id);
        listObs.subscribe((list) => {
          this.list = list;
          /*
            Cleared on the first emission after an add, whether or not it is that
            add's own: a write that never comes back costs one late, harmless
            `nearest` scroll instead of leaving a stale element held forever.
           */
          const row = this.pendingItemRow;
          this.pendingItemRow = null;
          keepInView(row);
        });
      }
    });
  }

  get showSharedWithInfo(): boolean {
    return (
      !!this.list?.isShared &&
      this.list.ownerUid === this.currentUserUid &&
      Object.keys(this.list.sharedWith ?? {}).length > 0
    );
  }

  get sharedWithTooltip(): string {
    return formatSharedWith(Object.values(this.list?.sharedWith ?? {}));
  }

  /*
    Only the owner may share. A private list has no owner recorded yet, so its
    creator is free to share it; once shared, recipients lose the button.
  */
  get canShare(): boolean {
    return !this.list?.isShared || this.list.ownerUid === this.currentUserUid;
  }

  /*
    The icon always shows the action, not the state: collapsed sections offer
    "expand", expanded ones offer "collapse".
   */
  get toggleSectionsIcon(): string {
    return this.sectionsCollapsed ? 'unfold_more' : 'unfold_less';
  }

  get toggleSectionsLabel(): string {
    return this.sectionsCollapsed ? 'Expand all sections' : 'Collapse all sections';
  }

  toggleSections(): void {
    this.sectionsCollapsed = !this.sectionsCollapsed;
  }

  /*
    The icon never changes: this button reports the mode you are in, and the
    label is the only place the next action can be spelled out.
   */
  get toggleChecklistLabel(): string {
    return this.checklistMode ? 'Turn checklist mode off' : 'Turn checklist mode on';
  }

  toggleChecklistMode(): void {
    this.checklistMode = !this.checklistMode;
  }

  get markedCount(): number {
    return (this.list?.sections ?? []).reduce(
      (total, section) => total + section.items.filter((item) => item.checked).length,
      0
    );
  }

  /*
    Only offered while there is something to clear, so the header keeps to at most
    four buttons on a phone for all the time the answer would be "nothing
    happened".
   */
  get canUnmarkAll(): boolean {
    return this.checklistMode && this.markedCount > 0;
  }

  /*
    Clears every mark on the list after asking. One write per section that had a
    mark, not per item, and the sections it rewrites get their legacy string items
    normalised on the way. A whole-array write carries the `checked` values this
    client last read, so it can clobber a co-editor's mark — the reason a tap goes
    through ListService.updateItemAt instead — but a bulk reset is rare and
    deliberate, so that risk is worth taking once.
   */
  unmarkAll(): void {
    if (!this.list) return;

    const count = this.markedCount;
    const data: ConfirmDialogData = {
      heading: 'Unmark all items?',
      message:
        count === 1
          ? '1 item is marked as ready.'
          : `${count} items are marked as ready.`,
      confirmLabel: 'Unmark all',
    };
    const dialogRef = this.dialog.open<DialogConfirmComponent, ConfirmDialogData, boolean>(
      DialogConfirmComponent,
      { width: '300px', data }
    );

    dialogRef.afterClosed().subscribe((confirmed: boolean | undefined) => {
      if (!confirmed || !this.list) return;

      this.list.sections
        .filter((section) => section.items.some((item) => item.checked))
        .forEach((section) => {
          section.items.forEach((item) => (item.checked = false));
          this.updateItems(section.id, section.items);
        });
    });
  }

  openShareDialog(): void {
    if (!this.list) return;
    this.dialog.open(DialogShareListComponent, {
      width: '300px',
      data: { listId: this.list.id },
    });
  }

  openDialogAddGroup(): void {
    if (this.recentlyDropped) return;
    this.groupService.getGroups().pipe(take(1)).subscribe((allGroups) => {
      const dialogRef = this.dialog.open(DialogAddGroupComponent, {
        width: '250px',
        data: { allGroups },
      });

      dialogRef.afterClosed().subscribe((result: AddSectionsResult | undefined) => {
        if (!result || !this.list) return;

        // An untitled section would be indistinguishable on screen, so a blank
        // field simply means "no new section" rather than an error.
        const newSectionTitle = result.newSectionTitle?.trim();
        if (newSectionTitle) {
          const obs = this.isShared
            ? this.listService.addEmptySharedSectionToList(this.list.id, newSectionTitle)
            : this.listService.addEmptySectionToList(this.list.id, newSectionTitle);
          obs.subscribe();
        }

        result.groups.forEach((group) => {
          const obs = this.isShared
            ? this.listService.addSharedSectionToList(this.list!.id, group)
            : this.listService.addSectionToList(this.list!.id, group);
          obs.subscribe();
        });
      });
    });
  }

  /*
    `itemRow` is optional so a caller with no element to keep on screen — a unit
    test, or a future non-template caller — still compiles.
   */
  onAddItemToSection(sectionId: string, item: string, itemRow?: HTMLElement): void {
    if (!this.list || !item.trim()) return;
    const section = this.list.sections.find((s) => s.id === sectionId);
    if (section) {
      this.pendingItemRow = itemRow ?? null;
      const updatedItems = [...section.items, { name: item.trim(), checked: false }];
      this.updateItems(sectionId, updatedItems);
    }
  }

  onItemPressStart(event: MouseEvent): void {
    this.itemTap.press(event);
  }

  /*
    Marks or unmarks one item. Off-mode taps do nothing at all: a mark is saved
    data, so it stays on screen either way, and the mode only decides whether a
    tap may change it. Only the tapped item is written — see
    ListService.updateItemAt.
   */
  toggleItemMark(section: Section, index: number, event: MouseEvent): void {
    if (!this.list || !this.checklistMode) return;
    if (!this.itemTap.isTap(event)) return;

    /*
      `index` comes from the row that was rendered, so it is in range for the
      array that produced it; this only stops a stale index from a future caller
      becoming a TypeError. The real index-as-path race — a stale index landing
      on the wrong item — is ListService.updateItemAt's, and documented there.
     */
    const item = section.items[index];
    if (!item) return;

    item.checked = !item.checked;
    const obs = this.isShared
      ? this.listService.updateSharedItemAt(this.list.id, section.id, index, item)
      : this.listService.updateItemAt(this.list.id, section.id, index, item);
    obs.subscribe();
  }

  renameLabel(section: Section): string {
    return `Rename section ${section.title}`;
  }

  onTitlePressStart(event: MouseEvent): void {
    this.titleTap.press(event);
  }

  /*
    Opens on a tap of the title, but not on the click that ends a drag of the
    section header — see `TapGuard`. Called without an event from the keyboard,
    which is always a tap.
   */
  openRenameDialog(section: Section, event?: MouseEvent): void {
    if (!this.list) return;
    if (!this.titleTap.isTap(event)) return;

    const data: RenameDialogData = { entity: 'section', title: section.title };
    const dialogRef = this.dialog.open(DialogRenameComponent, {
      width: '300px',
      data,
    });

    dialogRef.afterClosed().subscribe((title: string | undefined) => {
      if (!title || !this.list) return;
      const obs = this.isShared
        ? this.listService.renameSharedSection(this.list.id, section.id, title)
        : this.listService.renameSection(this.list.id, section.id, title);
      obs.subscribe();
    });
  }

  dropTrash(event: CdkDragDrop<any>): void {
    this.markRecentlyDropped();
    const dragData = event.item.data;
    if (!this.list) return;

    if (dragData?.type === 'section') {
      const obs = this.isShared
        ? this.listService.removeSharedSectionFromList(this.list.id, dragData.id)
        : this.listService.removeSectionFromList(this.list.id, dragData.id);
      obs.subscribe();
      return;
    }

    if (dragData?.type === 'item') {
      const section = this.list.sections.find(
        (s) => s.id === dragData.sectionId
      );
      if (section) {
        section.items.splice(event.previousIndex, 1);
        this.updateItems(section.id, section.items);
      }
    }
  }

  dropItem(event: CdkDragDrop<Item[]>): void {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
      const prevSectionId = this.resolveSectionId(event.previousContainer.id);
      const prevSection = this.list?.sections.find((s) => s.id === prevSectionId);
      if (prevSection && this.list) {
        this.updateItems(prevSection.id, prevSection.items);
      }
    }

    const sectionId = this.resolveSectionId(event.container.id);
    const section = this.list?.sections.find((s) => s.id === sectionId);
    if (section && this.list) {
      this.updateItems(section.id, section.items);
    }
  }

  getItemConnectedIds(sectionId: string): string[] {
    if (!this.list) return ['trash-list'];
    const otherIds = this.list.sections
      .filter((s) => s.id !== sectionId)
      .map((s) => 'cdk-drop-list-section-' + s.id);
    return ['trash-list', ...otherIds];
  }

  private updateItems(sectionId: string, items: Item[]): void {
    if (!this.list) return;
    const obs = this.isShared
      ? this.listService.updateSharedSectionItems(this.list.id, sectionId, items)
      : this.listService.updateSectionItems(this.list.id, sectionId, items);
    obs.subscribe();
  }

  private resolveSectionId(containerId: string): string {
    return containerId.replace('cdk-drop-list-section-', '');
  }

  private markRecentlyDropped(): void {
    this.recentlyDropped = true;
    setTimeout(() => (this.recentlyDropped = false));
  }
}
