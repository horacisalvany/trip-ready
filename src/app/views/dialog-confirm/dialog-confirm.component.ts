import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from 'src/app/material.module';

export interface ConfirmDialogData {
  heading: string;
  message: string;
  confirmLabel: string;
}

/*
  Asks one yes/no question. The app deletes by dragging to the trash, which is
  hard to do by accident and therefore asks nothing; a single tap that wipes a
  whole list's worth of marks with no undo is not, so F08 brought this in.
 */
@Component({
  selector: 'dialog-confirm',
  templateUrl: './dialog-confirm.component.html',
  styleUrls: ['./dialog-confirm.component.scss'],
  standalone: true,
  imports: [MaterialModule],
})
export class DialogConfirmComponent {
  constructor(
    public dialogRef: MatDialogRef<DialogConfirmComponent, boolean>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  /*
    Closes with an explicit false so that both buttons answer the question rather
    than one of them merely closing. Dismissing the dialog — backdrop or Escape —
    is Material's own close and yields undefined, and that is left alone on
    purpose: intercepting it would mean either asking every caller to open this
    with `disableClose: true`, which leaks the dialog's contract to the call site,
    or relying on our `close(false)` landing after Material's own to overwrite the
    pending result, which works by accident. So callers must read the answer as
    `=== true` rather than as "not false".
   */
  onCancel(): void {
    this.dialogRef.close(false);
  }
}
