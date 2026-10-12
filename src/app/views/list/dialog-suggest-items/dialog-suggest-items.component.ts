import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { Observable } from 'rxjs';
import { MaterialModule } from 'src/app/material.module';
import {
  RecommenderService,
  Suggestion,
  SuggestOutcome,
} from 'src/app/services/recommender.service';
import { List } from '../../lists/list';
import { matchSection, visibleSuggestions } from './suggestions';

export const NOTHING_MISSING_MESSAGE = 'Nothing obvious missing.';
export const QUOTA_MESSAGE = "You've used today's suggestions. Try again tomorrow.";
export const ERROR_MESSAGE = 'Could not get suggestions. Please try again.';

export interface SuggestItemsDialogData {
  list: List;
  /*
    Opens the trip note's edit dialog and writes the result, emitting the saved
    note ('' once cleared) and nothing at all when the user changed nothing.
    Supplied by ListComponent, so the note keeps exactly one place it is written.
   */
  editNote: () => Observable<string>;
}

/** A suggestion as the dialog shows it: ticked or not, and where it would land. */
export interface SuggestionRow {
  suggestion: Suggestion;
  checked: boolean;
  /** The section it goes into: the list's own spelling when one matches. */
  sectionTitle: string;
  isNewSection: boolean;
}

/*
  Asks the recommender (F12) for items the list might be missing and lets the
  user pick which to keep. It writes nothing itself: it closes with the ticked
  suggestions, and ListComponent adds them through the same paths as any other
  new item, so their failures are reported the same way too.

  Failures stay inside the dialog rather than going to a snackbar, as the share
  dialog's do: the user is still here to retry, and a message behind a closed
  dialog is no use.
 */
@Component({
  selector: 'dialog-suggest-items',
  templateUrl: './dialog-suggest-items.component.html',
  styleUrls: ['./dialog-suggest-items.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, MatDialogModule, MatCheckboxModule],
})
export class DialogSuggestItemsComponent {
  readonly nothingMissingMessage = NOTHING_MISSING_MESSAGE;
  note: string | undefined;
  loading = false;
  rows: SuggestionRow[] = [];
  /** A request came back with nothing to suggest. */
  nothingMissing = false;
  errorMessage = '';

  constructor(
    public dialogRef: MatDialogRef<DialogSuggestItemsComponent, Suggestion[]>,
    @Inject(MAT_DIALOG_DATA) public data: SuggestItemsDialogData,
    private recommender: RecommenderService
  ) {
    this.note = data.list.tripNote;
  }

  get checkedCount(): number {
    return this.rows.filter((row) => row.checked).length;
  }

  onEditNote(): void {
    this.data.editNote().subscribe((note) => (this.note = note || undefined));
  }

  onSuggest(): void {
    this.loading = true;
    this.errorMessage = '';
    this.nothingMissing = false;

    // The note on screen, which the pencil may have changed since the dialog opened.
    const list = { ...this.data.list, tripNote: this.note };
    this.recommender.suggest(list).subscribe((outcome) => this.show(outcome));
  }

  onAdd(): void {
    this.dialogRef.close(
      this.rows.filter((row) => row.checked).map((row) => row.suggestion)
    );
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  /* Every outcome stops the spinner: the service never errors, it only resolves. */
  private show(outcome: SuggestOutcome): void {
    this.loading = false;

    switch (outcome.kind) {
      case 'ok':
        this.rows = this.rowsFor(outcome.suggestions);
        this.nothingMissing = this.rows.length === 0;
        break;
      case 'quota':
        this.errorMessage = QUOTA_MESSAGE;
        break;
      case 'error':
        this.errorMessage = ERROR_MESSAGE;
        break;
      case 'signed-out':
        break;
    }
  }

  private rowsFor(suggestions: Suggestion[]): SuggestionRow[] {
    const sections = this.data.list.sections;
    return visibleSuggestions(suggestions, sections).map((suggestion) => {
      const match = matchSection(sections, suggestion.section);
      return {
        suggestion,
        checked: true,
        sectionTitle: match?.title ?? suggestion.section.trim(),
        isNewSection: !match,
      };
    });
  }
}
