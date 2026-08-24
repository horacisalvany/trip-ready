import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { AuthService } from '../../services/auth.service';
import { ListService } from '../list/list.service';
import { ShareService } from '../../services/share.service';
import { DialogAddListComponent } from './dialog-add-list/dialog-add-list.component';
import { List } from './list';
import { DRAG_START_DELAY } from '../drag-config';

@Component({
  selector: 'lists',
  templateUrl: './lists.component.html',
  styleUrls: ['./lists.component.scss'],
  standalone: true,
  imports: [CommonModule, MaterialModule, DragDropModule],
})
export class ListsComponent implements OnInit {
  lists: List[] = [];
  sharedLists: List[] = [];
  currentUserUid: string | null = null;
  readonly dragStartDelay = DRAG_START_DELAY;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    public dialog: MatDialog,
    private snackBar: MatSnackBar,
    private authService: AuthService,
    private listService: ListService,
    private shareService: ShareService
  ) {}

  ngOnInit(): void {
    this.authService.user$.subscribe((user) => {
      this.currentUserUid = user?.uid ?? null;
    });
    this.listService.getLists().subscribe((lists) => {
      this.lists = lists;
      this.filterDuplicates();
    });
    this.shareService.getSharedLists().subscribe((lists) => {
      this.sharedLists = lists;
      this.filterDuplicates();
    });
  }

  public onClickList(listId: string) {
    this.router.navigate([listId], {
      relativeTo: this.route,
    });
  }

  public onClickSharedList(listId: string) {
    this.router.navigate(['shared', listId], {
      relativeTo: this.route,
    });
  }

  dropTrash(event: CdkDragDrop<any>) {
    const dragData = event.item.data;
    if (!dragData) return;

    // Shared list drag data: { type: 'shared', id, ownerUid }
    if (dragData.type === 'shared') {
      if (dragData.ownerUid !== this.currentUserUid) {
        this.snackBar.open('Only the list creator can delete a shared list', 'OK', { duration: 3000 });
        return;
      }
      this.shareService.deleteSharedList(dragData.id).subscribe();
      return;
    }

    // Personal list drag data: plain string id
    this.listService.deleteList(dragData).subscribe();
  }

  dropList(_event: CdkDragDrop<any>) {
    // List order is managed by Firebase; no local reorder needed
  }

  private filterDuplicates(): void {
    const sharedIds = new Set(this.sharedLists.map((l) => l.id));
    this.lists = this.lists.filter((l) => !sharedIds.has(l.id));
  }

  openDialogAddList(
    enterAnimationDuration: string = '0ms',
    exitAnimationDuration: string = '0ms'
  ): void {
    const dialogRef = this.dialog.open(DialogAddListComponent, {
      width: '250px',
      enterAnimationDuration,
      exitAnimationDuration,
      data: { idsGroup: [] },
    });

    dialogRef.afterClosed().subscribe((titleList: string) => {
      if (titleList) {
        this.listService.addList(titleList).subscribe();
      }
    });
  }
}
