import {
  CdkDrag,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Group } from './group';
import { GroupService } from './group.service';
import { DialogCreateGroupComponent } from './dialog-add-group/dialog-add-group.component';
import {
  DialogRenameComponent,
  RenameDialogData,
} from '../dialog-rename/dialog-rename.component';
import { DRAG_START_DELAY } from '../drag-config';
import { TapGuard } from '../tap-guard';

@Component({
  selector: 'group',
  templateUrl: './group.component.html',
  styleUrls: ['./group.component.scss'],
})
export class GroupComponent implements OnInit {
  groups: Group[] = [];
  readonly dragStartDelay = DRAG_START_DELAY;
  /*
    Boolean to control that something has been dropped. Without there are bugs like missclicks after you drop a list on the trash
    and the popup of add a new list is opened for no reason.
   */
  private recentlyDropped = false;
  /*
    Tells a tap on a group title from the click that ends a drag of its header.
   */
  private readonly titleTap = new TapGuard();

  constructor(private groupService: GroupService, public dialog: MatDialog) {}

  ngOnInit(): void {
    this.loadgroups();
  }

  loadgroups() {
    this.groupService.getGroups().subscribe((result) => (this.groups = result));
  }

  drop(event: CdkDragDrop<string[]>) {
    const previousIndex = event.previousIndex;
    const currentIndex = event.currentIndex;

    const containerId = event.container.id;
    const group = this.groups.find(
      (a) => 'cdk-drop-list-' + a.id === containerId
    );

    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, previousIndex, currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        previousIndex,
        currentIndex
      );

      // Also update the source group
      const prevContainerId = event.previousContainer.id;
      const prevgroup = this.groups.find(
        (a) => 'cdk-drop-list-' + a.id === prevContainerId
      );
      if (prevgroup) {
        this.updateFirebase(prevgroup.id, prevgroup.items);
      }
    }

    if (group) {
      this.updateFirebase(group.id, group.items);
    }
  }

  updateFirebase(id: string, items: string[]) {
    this.groupService.updateGroup(id, items).subscribe(
      () => {
        console.log('Firebase updated successfully');
      },
      (error) => {
        console.error('Error updating Firebase:', error);
      }
    );
  }

  dropTrash(event: CdkDragDrop<string[]>) {
    this.markRecentlyDropped();
    const dragData = event.item.data;
    if (dragData?.type === 'group') {
      this.groupService.deleteGroup(dragData.id).subscribe();
      return;
    }
    const prevContainerId = event.previousContainer.id;
    const group = this.groups.find(
      (a) => 'cdk-drop-list-' + a.id === prevContainerId
    );
    if (group) {
      group.items.splice(event.previousIndex, 1);
      this.updateFirebase(group.id, group.items);
    }
  }

  dropGroupCard(event: CdkDragDrop<any[]>) {
    this.markRecentlyDropped();
    // Group order is managed by Firebase; no local reorder needed
  }

  private markRecentlyDropped(): void {
    this.recentlyDropped = true;
    setTimeout(() => (this.recentlyDropped = false));
  }

  groupCardPredicate = (drag: CdkDrag) => drag.data?.type === 'group';
  itemPredicate = (drag: CdkDrag) => drag.data?.type === 'item';

  onDelete(groupIndex: number, elementIndex: number) {
    const group = this.groups[groupIndex];
    group.items.splice(elementIndex, 1);
    this.updateFirebase(group.id, group.items);
  }

  onAdd(index: number, input: HTMLInputElement) {
    const value = input.value.trim();
    if (!value) return;
    const group = this.groups[index];
    group.items.push(value);
    this.updateFirebase(group.id, group.items);
  }

  renameLabel(group: Group): string {
    return `Rename group ${group.title}`;
  }

  onTitlePressStart(event: MouseEvent): void {
    this.titleTap.press(event);
  }

  /*
    Opens on a tap of the title, but not on the click that ends a drag of the
    group card — see `TapGuard`. Called without an event from the keyboard, which
    is always a tap. The view refreshes itself from the live groups stream, so
    nothing is mutated locally and no other group is touched.
   */
  openRenameDialog(group: Group, event?: MouseEvent): void {
    if (!this.titleTap.isTap(event)) return;

    const data: RenameDialogData = { entity: 'group', title: group.title };
    const dialogRef = this.dialog.open(DialogRenameComponent, {
      width: '300px',
      data,
    });

    dialogRef.afterClosed().subscribe((title: string | undefined) => {
      if (!title) return;
      this.groupService.renameGroup(group.id, title).subscribe();
    });
  }

  openDialogAddGroup(): void {
    if (this.recentlyDropped) return;
    const dialogRef = this.dialog.open(DialogCreateGroupComponent, {
      width: '250px',
      data: {},
    });

    dialogRef.afterClosed().subscribe((title: string) => {
      if (title) {
        this.groupService.addGroup(title).subscribe();
      }
    });
  }
}
