import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';

export const BLANK_TITLE_ERROR = 'Please enter a section name';

@Component({
  selector: 'dialog-rename-section',
  templateUrl: './dialog-rename-section.component.html',
  styleUrls: ['./dialog-rename-section.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, MatDialogModule],
})
export class DialogRenameSectionComponent {
  title: string;
  errorMessage = '';

  constructor(
    public dialogRef: MatDialogRef<DialogRenameSectionComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string }
  ) {
    this.title = data.title;
  }

  /*
    Closes with the new title, or keeps the dialog open with an error. A blank
    name is the only thing rejected: duplicates are allowed here just as they
    are when a section is created, "Ungrouped" included, since that section is
    no longer special. Renaming to the current title is a no-op rather than an
    error: the user has changed their mind, not made a mistake, so it closes
    without a value and the caller writes nothing.
   */
  onRename(): void {
    const title = this.title.trim();

    if (!title) {
      this.errorMessage = BLANK_TITLE_ERROR;
      return;
    }

    this.dialogRef.close(title === this.data.title.trim() ? undefined : title);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
