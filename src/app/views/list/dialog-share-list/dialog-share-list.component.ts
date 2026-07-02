import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { ShareService } from 'src/app/services/share.service';

@Component({
  selector: 'dialog-share-list',
  templateUrl: './dialog-share-list.component.html',
  styleUrls: ['./dialog-share-list.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, MatDialogModule],
})
export class DialogShareListComponent {
  email: string = '';
  errorMessage: string = '';
  loading: boolean = false;

  constructor(
    public dialogRef: MatDialogRef<DialogShareListComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { listId: string },
    private shareService: ShareService,
    private snackBar: MatSnackBar
  ) {}

  onShare(): void {
    if (!this.email) {
      this.errorMessage = 'Please enter an email address';
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.shareService.lookupUserByEmail(this.email).subscribe((uid) => {
      if (!uid) {
        this.errorMessage =
          'User not found. They must have logged in at least once.';
        this.loading = false;
        return;
      }

      this.shareService
        .shareList(this.data.listId, uid, this.email)
        .subscribe(() => {
          this.snackBar.open(`List shared with ${this.email}`, 'OK', {
            duration: 3000,
          });
          this.dialogRef.close(true);
        });
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
