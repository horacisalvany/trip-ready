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
import { DialogRenameSectionComponent } from './dialog-rename-section/dialog-rename-section.component';
import { DialogShareListComponent } from './dialog-share-list/dialog-share-list.component';
import { ListService, UNGROUPED_SECTION_TITLE } from './list.service';
import { Section } from './section';
import { DRAG_START_DELAY } from '../drag-config';

/*
  How far the pointer may travel between pressing a section title and releasing
  it and still count as a tap. Same 5px CDK uses to decide a drag has begun, so
  a gesture is either a tap or a drag, never both.
 */
export const TAP_MOVE_TOLERANCE_PX = 5;

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
  readonly dragStartDelay = DRAG_START_DELAY;
  currentUserUid: string | null = null;
  /*
    Boolean to control that something has been dropped. Without there are bugs like missclicks after you drop a list on the trash
    and the popup of add a new list is opened for no reason.
   */
  private recentlyDropped = false;
  /*
    Where the mouse went down on a section title, so a click that ends far from
    it can be recognised as the tail of a drag and ignored.
   */
  private titlePressAt: { x: number; y: number } | null = null;

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

  onAddItemToSection(sectionId: string, item: string): void {
    if (!this.list || !item.trim()) return;
    const section = this.list.sections.find((s) => s.id === sectionId);
    if (section) {
      const updatedItems = [...section.items, item.trim()];
      this.updateItems(sectionId, updatedItems);
    }
  }

  isUngroupedSection(title: string): boolean {
    return title === UNGROUPED_SECTION_TITLE;
  }

  /*
    Ungrouped is identified by its title everywhere in the app, so it is the one
    section whose name has to stay put.
   */
  isRenameable(section: Section): boolean {
    return !this.isUngroupedSection(section.title);
  }

  renameLabel(section: Section): string {
    return `Rename section ${section.title}`;
  }

  onTitlePressStart(event: MouseEvent): void {
    this.titlePressAt = { x: event.clientX, y: event.clientY };
  }

  /*
    A click is only a tap if the pointer barely moved since it went down. CDK
    does not suppress the click that follows a mouse drag, so without this a
    short drag of a section header would also open the rename dialog.

    Deliberately derived from the event rather than from a flag toggled by
    cdkDragStarted/cdkDragEnded: a section dropped on the trash can be gone from
    the DOM before cdkDragEnded fires, which would leave such a flag stuck on
    and silently break renaming from then on.
   */
  openRenameDialog(section: Section, event?: MouseEvent): void {
    if (!this.list || !this.isRenameable(section)) return;

    const pressedAt = this.titlePressAt;
    this.titlePressAt = null;
    if (event) {
      // A pointer click always follows a press on the title. One that does not
      // cannot be vouched for, so it is not treated as a tap.
      if (!pressedAt) return;
      const moved =
        Math.abs(event.clientX - pressedAt.x) +
        Math.abs(event.clientY - pressedAt.y);
      if (moved > TAP_MOVE_TOLERANCE_PX) return;
    }

    const dialogRef = this.dialog.open(DialogRenameSectionComponent, {
      width: '300px',
      data: { title: section.title },
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
      const section = this.list.sections.find((s) => s.id === dragData.id);
      if (section && this.isUngroupedSection(section.title)) return;
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

  dropItem(event: CdkDragDrop<string[]>): void {
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

  private updateItems(sectionId: string, items: string[]): void {
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
