import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';

/** What is being renamed. The only thing that differs on screen. */
export type RenameEntity = 'section' | 'group';

export interface RenameDialogData {
  entity: RenameEntity;
  title: string;
}

export function blankTitleError(entity: RenameEntity): string {
  return `Please enter a ${entity} name`;
}

/*
  Renames one thing: a list section (F05) or a group (F06). Sections and groups
  are titled the same way, capped at the same length and validated by the same
  rule, so they share the dialog and only the noun changes.
 */
@Component({
  selector: 'dialog-rename',
  templateUrl: './dialog-rename.component.html',
  styleUrls: ['./dialog-rename.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, MatDialogModule],
})
export class DialogRenameComponent {
  title: string;
  errorMessage = '';

  constructor(
    public dialogRef: MatDialogRef<DialogRenameComponent>,
    @Inject(MAT_DIALOG_DATA) public data: RenameDialogData
  ) {
    this.title = data.title;
  }

  get heading(): string {
    return `Rename ${this.data.entity}`;
  }

  /** "Section name", "Group name" — the field has no visible label. */
  get fieldLabel(): string {
    const entity = this.data.entity;
    return `${entity[0].toUpperCase()}${entity.slice(1)} name`;
  }

  /*
    Closes with the new title, or keeps the dialog open with an error. A blank
    name is the only thing rejected: duplicates are allowed here just as they
    are when a section or a group is created, "Ungrouped" included, since that
    section is no longer special. Renaming to the current title is a no-op rather
    than an error: the user has changed their mind, not made a mistake, so it
    closes without a value and the caller writes nothing.
   */
  onRename(): void {
    const title = this.title.trim();

    if (!title) {
      this.errorMessage = blankTitleError(this.data.entity);
      return;
    }

    this.dialogRef.close(title === this.data.title.trim() ? undefined : title);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
