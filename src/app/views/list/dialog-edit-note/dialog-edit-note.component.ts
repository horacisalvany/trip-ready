import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';

/** Same cap the recommender service enforces on `tripNote`. */
export const NOTE_MAX_LENGTH = 200;

export interface EditNoteDialogData {
  note?: string;
}

export function noteTooLongError(): string {
  return `Please keep the note to ${NOTE_MAX_LENGTH} characters or fewer`;
}

/*
  Edits a list's trip note (F12). Shaped like the rename dialog, with one
  difference: a blank note is not rejected, since "no note" is a valid answer,
  and closes with '' for the caller to write as a clear.

  The close value is the whole contract: `undefined` writes nothing (cancelled,
  or unchanged), '' clears the note, anything else is the new note.
 */
@Component({
  selector: 'dialog-edit-note',
  templateUrl: './dialog-edit-note.component.html',
  styleUrls: ['./dialog-edit-note.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, MatDialogModule],
})
export class DialogEditNoteComponent {
  readonly maxLength = NOTE_MAX_LENGTH;
  note: string;
  errorMessage = '';

  constructor(
    public dialogRef: MatDialogRef<DialogEditNoteComponent>,
    @Inject(MAT_DIALOG_DATA) public data: EditNoteDialogData
  ) {
    this.note = data.note ?? '';
  }

  onSave(): void {
    const note = this.note.trim();

    if (note.length > NOTE_MAX_LENGTH) {
      this.errorMessage = noteTooLongError();
      return;
    }

    this.dialogRef.close(note === (this.data.note ?? '').trim() ? undefined : note);
  }

  onCancel(): void {
    this.dialogRef.close();
  }
}
