import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { Group } from 'src/app/views/group/group';

/*
  Both ways of adding a section come back together: a brand new empty section
  named by hand, and one section per group the user ticked. Either half may be
  empty — the caller decides what to do with each.
 */
export interface AddSectionsResult {
  groups: Group[];
  newSectionTitle: string;
}

@Component({
  selector: 'dialog-add-group',
  templateUrl: './dialog-add-group.component.html',
  styleUrls: ['./dialog-add-group.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatCheckboxModule,
  ],
})
export class DialogAddGroupComponent {
  groups: Group[];
  selected: Set<string> = new Set();
  newSectionTitle = '';

  constructor(
    public dialogRef: MatDialogRef<DialogAddGroupComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { allGroups: Group[] }
  ) {
    this.groups = data.allGroups;
  }

  onGroup(id: string) {
    if (this.selected.has(id)) {
      this.selected.delete(id);
    } else {
      this.selected.add(id);
    }
  }

  getResult(): AddSectionsResult {
    return {
      groups: this.groups.filter((g) => this.selected.has(g.id)),
      newSectionTitle: this.newSectionTitle,
    };
  }
}
