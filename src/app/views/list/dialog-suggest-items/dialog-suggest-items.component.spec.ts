import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Observable, Subject, of } from 'rxjs';
import {
  RecommenderService,
  Suggestion,
  SuggestOutcome,
} from 'src/app/services/recommender.service';
import { List } from '../../lists/list';
import { unmarkedItems } from '../item';
import {
  DialogSuggestItemsComponent,
  ERROR_MESSAGE,
  NOTHING_MISSING_MESSAGE,
  QUOTA_MESSAGE,
  SuggestItemsDialogData,
} from './dialog-suggest-items.component';

const LIST: List = {
  id: 'list1',
  title: 'Ski Andorra',
  tripNote: '1 week skiing',
  sections: [
    { id: 's1', title: 'Clothes', items: unmarkedItems(['Ski jacket']) },
    { id: 's2', title: 'Documents', items: unmarkedItems(['Passport']) },
  ],
};

const SUGGESTIONS: Suggestion[] = [
  { name: 'Ski gloves', section: 'clothes ', reason: 'Cold hands end a ski day early.' },
  { name: 'Sunscreen', section: 'Toiletries', reason: 'UV is stronger at altitude.' },
  { name: 'EHIC card', section: 'Documents', reason: 'Emergency care in the EU.' },
];

describe('DialogSuggestItemsComponent', () => {
  let fixture: ComponentFixture<DialogSuggestItemsComponent>;
  let component: DialogSuggestItemsComponent;
  let dialogRef: jasmine.SpyObj<MatDialogRef<DialogSuggestItemsComponent>>;
  let recommender: jasmine.SpyObj<RecommenderService>;
  let data: SuggestItemsDialogData;
  let editNote: jasmine.Spy<() => Observable<string>>;

  function render(): void {
    fixture = TestBed.createComponent(DialogSuggestItemsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  function query(selector: string) {
    return fixture.debugElement.query(By.css(selector));
  }

  function textOf(selector: string): string | null {
    const el = query(selector);
    return el ? el.nativeElement.textContent.trim() : null;
  }

  function click(selector: string): void {
    query(selector).nativeElement.click();
    fixture.detectChanges();
  }

  /* Renders, then asks for suggestions and gets `outcome` back at once. */
  function suggestWith(outcome: SuggestOutcome): void {
    recommender.suggest.and.returnValue(of(outcome));
    render();
    click('.suggest');
  }

  function rows() {
    return fixture.debugElement.queryAll(By.css('.suggestion'));
  }

  beforeEach(async () => {
    dialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    recommender = jasmine.createSpyObj('RecommenderService', ['suggest']);
    editNote = jasmine.createSpy('editNote').and.returnValue(of('2 weeks Japan'));
    data = { list: LIST, editNote };

    await TestBed.configureTestingModule({
      imports: [DialogSuggestItemsComponent, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: RecommenderService, useValue: recommender },
      ],
    }).compileComponents();
  });

  describe('the trip note', () => {
    it('should show the current note, read-only', () => {
      render();

      expect(textOf('.note-text')).toBe('1 week skiing');
      expect(query('.note-row input, .note-row textarea')).toBeNull();
    });

    it('should say so when the list has no note', () => {
      data.list = { ...LIST, tripNote: undefined };

      render();

      expect(textOf('.note-text')).toBe('No trip note');
    });

    /* The pencil goes to the one edit surface the header uses, not a copy of it. */
    it('should edit the note through the callback and show the saved one', () => {
      render();

      click('.edit-note');

      expect(editNote).toHaveBeenCalled();
      expect(textOf('.note-text')).toBe('2 weeks Japan');
    });

    it('should show no note once the note is cleared', () => {
      editNote.and.returnValue(of(''));
      render();

      click('.edit-note');

      expect(textOf('.note-text')).toBe('No trip note');
    });

    it('should send the edited note with the next request', () => {
      recommender.suggest.and.returnValue(of({ kind: 'ok', suggestions: [] }));
      render();
      click('.edit-note');

      click('.suggest');

      expect(recommender.suggest).toHaveBeenCalledWith(
        jasmine.objectContaining({ id: 'list1', tripNote: '2 weeks Japan' })
      );
    });
  });

  describe('asking for suggestions', () => {
    it('should not ask before "Suggest items" is pressed', () => {
      render();

      expect(recommender.suggest).not.toHaveBeenCalled();
      expect(rows().length).toBe(0);
    });

    it('should send the list', () => {
      suggestWith({ kind: 'ok', suggestions: [] });

      expect(recommender.suggest).toHaveBeenCalledWith(
        jasmine.objectContaining({ id: 'list1', title: 'Ski Andorra', tripNote: '1 week skiing' })
      );
    });

    it('should spin while the request is in flight, and stop when it ends', () => {
      const response = new Subject<SuggestOutcome>();
      recommender.suggest.and.returnValue(response);
      render();

      click('.suggest');
      expect(query('mat-spinner')).not.toBeNull();
      expect(query('.suggest').nativeElement.disabled).toBeTrue();

      response.next({ kind: 'ok', suggestions: SUGGESTIONS });
      fixture.detectChanges();
      expect(query('mat-spinner')).toBeNull();
    });

    /* The spinner rule the share dialog follows: never left spinning on failure. */
    for (const outcome of [
      { kind: 'error' },
      { kind: 'quota' },
      { kind: 'signed-out' },
    ] as SuggestOutcome[]) {
      it(`should stop spinning on the ${outcome.kind} outcome`, () => {
        suggestWith(outcome);

        expect(query('mat-spinner')).toBeNull();
      });
    }
  });

  describe('showing suggestions', () => {
    beforeEach(() => suggestWith({ kind: 'ok', suggestions: SUGGESTIONS }));

    it('should show each suggestion with its name, section and reason', () => {
      const first = rows()[0];

      expect(first.query(By.css('.suggestion-name')).nativeElement.textContent.trim()).toBe(
        'Ski gloves'
      );
      expect(first.query(By.css('.suggestion-reason')).nativeElement.textContent.trim()).toBe(
        'Cold hands end a ski day early.'
      );
    });

    /* Matched: shown under the list's own spelling, the section it will really land in. */
    it("should name a matched section the way the list spells it", () => {
      expect(
        rows()[0].query(By.css('.section-title')).nativeElement.textContent.trim()
      ).toBe('Clothes');
      expect(rows()[0].query(By.css('.new-section'))).toBeNull();
    });

    it('should mark a section the list does not have as new', () => {
      const row = rows()[1];

      expect(row.query(By.css('.section-title')).nativeElement.textContent.trim()).toBe(
        'Toiletries'
      );
      expect(row.query(By.css('.new-section'))).not.toBeNull();
    });

    it('should start with every suggestion checked', () => {
      expect(component.rows.every((row) => row.checked)).toBeTrue();
      expect(textOf('.add')).toBe('Add 3');
    });

    it('should replace "Suggest items" with "Add" once there are suggestions', () => {
      expect(query('.suggest')).toBeNull();
      expect(query('.add')).not.toBeNull();
    });

    it('should close with every checked suggestion when confirmed', () => {
      click('.add');

      expect(dialogRef.close).toHaveBeenCalledWith(SUGGESTIONS);
    });

    it('should leave out a suggestion that was unchecked', () => {
      component.rows[1].checked = false;
      fixture.detectChanges();

      click('.add');

      expect(textOf('.add')).toBe('Add 2');
      expect(dialogRef.close).toHaveBeenCalledWith([SUGGESTIONS[0], SUGGESTIONS[2]]);
    });

    it('should not offer to add nothing', () => {
      component.rows.forEach((row) => (row.checked = false));
      fixture.detectChanges();

      expect(query('.add').nativeElement.disabled).toBeTrue();
    });

    it('should close with nothing when cancelled', () => {
      click('.cancel');

      expect(dialogRef.close).toHaveBeenCalledWith();
    });
  });

  it('should never show an item already on the list, nor more than 10', () => {
    const many: Suggestion[] = [
      { name: 'ski jacket', section: 'Clothes', reason: 'Already there.' },
      ...Array.from({ length: 11 }, (_, i) => ({
        name: `Item ${i}`,
        section: 'Clothes',
        reason: 'Because.',
      })),
    ];

    suggestWith({ kind: 'ok', suggestions: many });

    expect(rows().length).toBe(10);
    expect(component.rows.map((row) => row.suggestion.name)).not.toContain('ski jacket');
  });

  describe('outcomes other than suggestions', () => {
    it('should say nothing obvious is missing when there are no suggestions', () => {
      suggestWith({ kind: 'ok', suggestions: [] });

      expect(textOf('.empty')).toBe(NOTHING_MISSING_MESSAGE);
      expect(NOTHING_MISSING_MESSAGE).toBe('Nothing obvious missing.');
      expect(query('.error-message')).toBeNull();
    });

    it('should show the daily limit and stay open', () => {
      suggestWith({ kind: 'quota' });

      expect(textOf('.error-message')).toBe(QUOTA_MESSAGE);
      expect(QUOTA_MESSAGE).toBe("You've used today's suggestions. Try again tomorrow.");
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('should show a failure and stay open', () => {
      suggestWith({ kind: 'error' });

      expect(textOf('.error-message')).toBe(ERROR_MESSAGE);
      expect(ERROR_MESSAGE).toBe('Could not get suggestions. Please try again.');
      expect(dialogRef.close).not.toHaveBeenCalled();
    });

    /* Retryable without reopening: the button is still there and asks again. */
    it('should retry from the same dialog after a failure', () => {
      suggestWith({ kind: 'error' });
      recommender.suggest.and.returnValue(of({ kind: 'ok', suggestions: SUGGESTIONS }));

      click('.suggest');

      expect(recommender.suggest).toHaveBeenCalledTimes(2);
      expect(query('.error-message')).toBeNull();
      expect(rows().length).toBe(3);
    });

    /* Signed out: the redirect to /login is already under way, so say nothing. */
    it('should show no message when signed out', () => {
      suggestWith({ kind: 'signed-out' });

      expect(query('.error-message')).toBeNull();
      expect(query('.empty')).toBeNull();
    });
  });
});
