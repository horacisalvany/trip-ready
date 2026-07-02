# Shared Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to share travel checklists with other users by email, so multiple people can collaborate on the same list in real time.

**Architecture:** Today, lists live under `users/{uid}/lists/{listId}`. To enable sharing, we move list data to a top-level `sharedLists/{listId}` node in Firebase and store references under each user's profile at `users/{uid}/sharedListIds/{listId}: true`. The owner (creator) can share a list by entering another user's email. A `userEmails/{sanitizedEmail}: uid` lookup node maps emails to UIDs. All existing "my lists" functionality remains unchanged at `users/{uid}/lists/`; shared lists appear in a separate "Shared with me" section on the lists view.

**Tech Stack:** Angular 16, Angular Material 16, Firebase Realtime Database (AngularFire compat), Karma + Jasmine

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/views/lists/list.ts` | Modify | Add optional `ownerUid`, `ownerEmail`, `sharedWith` fields to `List` interface |
| `src/app/services/share.service.ts` | Create | All Firebase operations for sharing: lookup user by email, share/unshare, get shared lists |
| `src/app/services/share.service.spec.ts` | Create | Tests for ShareService |
| `src/app/views/list/list.service.ts` | Modify | Add methods to create/read/update/delete shared lists at `sharedLists/` path |
| `src/app/views/list/list.service.spec.ts` | Create | Tests for new ListService shared-list methods |
| `src/app/views/lists/lists.component.ts` | Modify | Load and display shared lists alongside personal lists |
| `src/app/views/lists/lists.component.html` | Modify | Add "Shared with me" section |
| `src/app/views/lists/lists.component.scss` | Modify | Styles for shared list badges and section divider |
| `src/app/views/lists/lists.component.spec.ts` | Modify | Tests for shared lists display |
| `src/app/views/list/dialog-share-list/dialog-share-list.component.ts` | Create | Dialog to enter email and share a list |
| `src/app/views/list/dialog-share-list/dialog-share-list.component.html` | Create | Dialog template |
| `src/app/views/list/dialog-share-list/dialog-share-list.component.scss` | Create | Dialog styles |
| `src/app/views/list/dialog-share-list/dialog-share-list.component.spec.ts` | Create | Dialog tests |
| `src/app/views/list/list.component.ts` | Modify | Add share button that opens the dialog |
| `src/app/views/list/list.component.html` | Modify | Add share icon button in header |
| `src/app/views/list/list.component.spec.ts` | Modify | Tests for share button |
| `src/app/services/auth.service.ts` | Modify | Add method to register email-to-UID mapping on login |
| `src/app/app-routing.module.ts` | Modify | Add route `shared/:id` for shared list view |

---

### Task 1: Extend the List interface with sharing metadata

**Files:**
- Modify: `src/app/views/lists/list.ts`

- [ ] **Step 1: Add sharing fields to the List interface**

```typescript
// src/app/views/lists/list.ts
import { Section } from '../list/section';

export interface List {
  id: string;
  title: string;
  sections: Section[];
  ownerUid?: string;
  ownerEmail?: string;
  sharedWith?: { [uid: string]: string }; // uid -> email
  isShared?: boolean; // true when this list lives at sharedLists/ path
}
```

- [ ] **Step 2: Run tests to verify nothing breaks**

Run: `yarn test --no-watch --browsers=ChromeHeadless`
Expected: All existing tests PASS (the new fields are optional, so no existing code breaks)

- [ ] **Step 3: Commit**

```bash
git add src/app/views/lists/list.ts
git commit -m "feat: add sharing metadata fields to List interface"
```

---

### Task 2: Register email-to-UID lookup on login

When a user logs in or registers, we write their email to `userEmails/{sanitizedEmail}: uid` so other users can look them up by email. Firebase keys cannot contain `.`, so we replace `.` with `,` in the email.

**Files:**
- Modify: `src/app/services/auth.service.ts`

- [ ] **Step 1: Write the failing test**

Create the test file if it doesn't exist:

```typescript
// src/app/services/auth.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { Auth } from '@angular/fire/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let mockDb: jasmine.SpyObj<AngularFireDatabase>;
  let mockDbObject: jasmine.SpyObj<any>;

  beforeEach(() => {
    mockDbObject = jasmine.createSpyObj('AngularFireObject', ['set']);
    mockDbObject.set.and.returnValue(Promise.resolve());

    mockDb = jasmine.createSpyObj('AngularFireDatabase', ['object']);
    mockDb.object.and.returnValue(mockDbObject);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Auth, useValue: {} },
        { provide: AngularFireDatabase, useValue: mockDb },
      ],
    });
    service = TestBed.inject(AuthService);
  });

  describe('registerEmailLookup', () => {
    it('should write sanitized email to userEmails path', async () => {
      await service.registerEmailLookup('alice@example.com', 'uid123');

      expect(mockDb.object).toHaveBeenCalledWith('userEmails/alice@example,com');
      expect(mockDbObject.set).toHaveBeenCalledWith('uid123');
    });

    it('should sanitize dots in email domain', async () => {
      await service.registerEmailLookup('bob@my.company.org', 'uid456');

      expect(mockDb.object).toHaveBeenCalledWith('userEmails/bob@my,company,org');
    });
  });

  describe('sanitizeEmail', () => {
    it('should replace dots with commas', () => {
      expect(service.sanitizeEmail('test@foo.bar.com')).toBe('test@foo,bar,com');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test --no-watch --browsers=ChromeHeadless --include=src/app/services/auth.service.spec.ts`
Expected: FAIL - `registerEmailLookup` is not a function

- [ ] **Step 3: Implement registerEmailLookup and sanitizeEmail**

```typescript
// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  user,
} from '@angular/fire/auth';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable, map } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  user$ = user(this.auth);
  isAuthenticated$: Observable<boolean> = this.user$.pipe(map((u) => !!u));

  constructor(private auth: Auth, private db: AngularFireDatabase) {}

  sanitizeEmail(email: string): string {
    return email.replace(/\./g, ',');
  }

  async registerEmailLookup(email: string, uid: string): Promise<void> {
    const sanitized = this.sanitizeEmail(email);
    await this.db.object(`userEmails/${sanitized}`).set(uid);
  }

  async login(email: string, password: string) {
    const credential = await signInWithEmailAndPassword(this.auth, email, password);
    if (credential.user?.email) {
      await this.registerEmailLookup(credential.user.email, credential.user.uid);
    }
    return credential;
  }

  async loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(this.auth, provider);
    if (credential.user?.email) {
      await this.registerEmailLookup(credential.user.email, credential.user.uid);
    }
    return credential;
  }

  async register(email: string, password: string) {
    const credential = await createUserWithEmailAndPassword(this.auth, email, password);
    if (credential.user?.email) {
      await this.registerEmailLookup(credential.user.email, credential.user.uid);
    }
    return credential;
  }

  logout() {
    return signOut(this.auth);
  }
}
```

Note: `login`, `loginWithGoogle`, and `register` now return Promises instead of the raw Firebase calls. Callers that used `.then()` will still work. Check `src/app/views/login/login.component.ts` to make sure it handles this correctly (it likely already uses `await` or `.then()`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test --no-watch --browsers=ChromeHeadless --include=src/app/services/auth.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Run all tests to check for regressions**

Run: `yarn test --no-watch --browsers=ChromeHeadless`
Expected: All PASS. If the login component tests fail because `login()` now returns a Promise instead of the raw Firebase return, update those tests to handle the Promise.

- [ ] **Step 6: Commit**

```bash
git add src/app/services/auth.service.ts src/app/services/auth.service.spec.ts
git commit -m "feat: register email-to-UID lookup in Firebase on login"
```

---

### Task 3: Create ShareService

This service handles all sharing operations: looking up a user by email, sharing a list, unsharing, and loading shared lists.

**Files:**
- Create: `src/app/services/share.service.ts`
- Create: `src/app/services/share.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/app/services/share.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { of } from 'rxjs';
import { ShareService } from './share.service';
import { AuthService } from './auth.service';

describe('ShareService', () => {
  let service: ShareService;
  let mockDb: jasmine.SpyObj<AngularFireDatabase>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockDbObject: jasmine.SpyObj<any>;
  let mockDbList: jasmine.SpyObj<any>;

  beforeEach(() => {
    mockDbObject = jasmine.createSpyObj('AngularFireObject', [
      'valueChanges',
      'set',
      'remove',
      'update',
    ]);
    mockDbList = jasmine.createSpyObj('AngularFireList', ['snapshotChanges']);

    mockDb = jasmine.createSpyObj('AngularFireDatabase', ['object', 'list']);
    mockDb.object.and.returnValue(mockDbObject);
    mockDb.list.and.returnValue(mockDbList);

    mockAuthService = jasmine.createSpyObj('AuthService', ['sanitizeEmail'], {
      user$: of({ uid: 'ownerUid', email: 'owner@test.com' }),
    });
    mockAuthService.sanitizeEmail.and.callFake((e: string) => e.replace(/\./g, ','));

    TestBed.configureTestingModule({
      providers: [
        ShareService,
        { provide: AngularFireDatabase, useValue: mockDb },
        { provide: AuthService, useValue: mockAuthService },
      ],
    });
    service = TestBed.inject(ShareService);
  });

  describe('lookupUserByEmail', () => {
    it('should return uid when email exists', (done) => {
      mockDbObject.valueChanges.and.returnValue(of('targetUid'));

      service.lookupUserByEmail('alice@example.com').subscribe((uid) => {
        expect(mockDb.object).toHaveBeenCalledWith('userEmails/alice@example,com');
        expect(uid).toBe('targetUid');
        done();
      });
    });

    it('should return null when email not found', (done) => {
      mockDbObject.valueChanges.and.returnValue(of(null));

      service.lookupUserByEmail('nobody@example.com').subscribe((uid) => {
        expect(uid).toBeNull();
        done();
      });
    });
  });

  describe('shareList', () => {
    it('should copy list to sharedLists and add references for both users', (done) => {
      const listData = { title: 'Trip', sections: {} };
      mockDbObject.set.and.returnValue(Promise.resolve());
      // First call: read existing list data
      mockDbObject.valueChanges.and.returnValue(of(listData));

      service.shareList('list1', 'targetUid', 'target@test.com').subscribe(() => {
        // Should have written to sharedLists, owner's sharedListIds, and target's sharedListIds
        expect(mockDbObject.set).toHaveBeenCalled();
        done();
      });
    });
  });

  describe('getSharedLists', () => {
    it('should return empty array when user has no shared lists', (done) => {
      mockDbObject.valueChanges.and.returnValue(of(null));

      service.getSharedLists().subscribe((lists) => {
        expect(lists).toEqual([]);
        done();
      });
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `yarn test --no-watch --browsers=ChromeHeadless --include=src/app/services/share.service.spec.ts`
Expected: FAIL - Cannot find module `./share.service`

- [ ] **Step 3: Implement ShareService**

```typescript
// src/app/services/share.service.ts
import { Injectable } from '@angular/core';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { Observable, from, of, switchMap, map, take, forkJoin } from 'rxjs';
import { AuthService } from './auth.service';
import { List } from '../views/lists/list';

@Injectable({
  providedIn: 'root',
})
export class ShareService {
  constructor(
    private db: AngularFireDatabase,
    private authService: AuthService
  ) {}

  lookupUserByEmail(email: string): Observable<string | null> {
    const sanitized = this.authService.sanitizeEmail(email);
    return this.db
      .object<string>(`userEmails/${sanitized}`)
      .valueChanges()
      .pipe(
        take(1),
        map((uid) => uid ?? null)
      );
  }

  shareList(
    listId: string,
    targetUid: string,
    targetEmail: string
  ): Observable<void> {
    return this.authService.user$.pipe(
      take(1),
      switchMap((user) => {
        if (!user) return of(undefined as void);
        const ownerUid = user.uid;
        const ownerEmail = user.email ?? '';

        // 1. Read the current list data from user's private lists
        return this.db
          .object(`users/${ownerUid}/lists/${listId}`)
          .valueChanges()
          .pipe(
            take(1),
            switchMap((listData: any) => {
              if (!listData) return of(undefined as void);

              const sharedListData = {
                ...listData,
                ownerUid,
                ownerEmail,
                sharedWith: {
                  [targetUid]: targetEmail,
                },
              };

              // 2. Write to sharedLists/{listId}
              const writeShared = from(
                this.db.object(`sharedLists/${listId}`).set(sharedListData)
              );

              // 3. Add reference for owner
              const writeOwnerRef = from(
                this.db
                  .object(`users/${ownerUid}/sharedListIds/${listId}`)
                  .set(true)
              );

              // 4. Add reference for target user
              const writeTargetRef = from(
                this.db
                  .object(`users/${targetUid}/sharedListIds/${listId}`)
                  .set(true)
              );

              return forkJoin([writeShared, writeOwnerRef, writeTargetRef]).pipe(
                map(() => undefined as void)
              );
            })
          );
      })
    );
  }

  unshareList(listId: string, targetUid: string): Observable<void> {
    return from(
      this.db.object(`sharedLists/${listId}/sharedWith/${targetUid}`).remove()
    ).pipe(
      switchMap(() =>
        from(this.db.object(`users/${targetUid}/sharedListIds/${listId}`).remove())
      )
    );
  }

  getSharedLists(): Observable<List[]> {
    return this.authService.user$.pipe(
      switchMap((user) => {
        if (!user) return of([]);
        return this.db
          .object<{ [listId: string]: boolean }>(
            `users/${user.uid}/sharedListIds`
          )
          .valueChanges()
          .pipe(
            switchMap((sharedIds) => {
              if (!sharedIds) return of([]);
              const listIds = Object.keys(sharedIds);
              if (listIds.length === 0) return of([]);

              const listObservables = listIds.map((id) =>
                this.db
                  .object(`sharedLists/${id}`)
                  .valueChanges()
                  .pipe(
                    take(1),
                    map((data: any) => {
                      if (!data) return null;
                      return {
                        id,
                        title: data.title ?? 'Untitled',
                        sections: this.parseSections(data.sections),
                        ownerUid: data.ownerUid,
                        ownerEmail: data.ownerEmail,
                        sharedWith: data.sharedWith,
                        isShared: true,
                      } as List;
                    })
                  )
              );

              return forkJoin(listObservables).pipe(
                map((lists) => lists.filter((l): l is List => l !== null))
              );
            })
          );
      })
    );
  }

  private parseSections(sectionsObj: any): any[] {
    if (!sectionsObj || typeof sectionsObj !== 'object') return [];
    return Object.keys(sectionsObj).map((key) => ({
      id: key,
      title: sectionsObj[key]?.title ?? 'Untitled',
      items: sectionsObj[key]?.items ?? [],
      sourceGroupId: sectionsObj[key]?.sourceGroupId,
    }));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test --no-watch --browsers=ChromeHeadless --include=src/app/services/share.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/services/share.service.ts src/app/services/share.service.spec.ts
git commit -m "feat: create ShareService for list sharing operations"
```

---

### Task 4: Create the Share List Dialog

A dialog where the list owner enters an email to share the list with.

**Files:**
- Create: `src/app/views/list/dialog-share-list/dialog-share-list.component.ts`
- Create: `src/app/views/list/dialog-share-list/dialog-share-list.component.html`
- Create: `src/app/views/list/dialog-share-list/dialog-share-list.component.scss`
- Create: `src/app/views/list/dialog-share-list/dialog-share-list.component.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/app/views/list/dialog-share-list/dialog-share-list.component.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { DialogShareListComponent } from './dialog-share-list.component';
import { ShareService } from '../../../services/share.service';

describe('DialogShareListComponent', () => {
  let component: DialogShareListComponent;
  let fixture: ComponentFixture<DialogShareListComponent>;
  let mockShareService: jasmine.SpyObj<ShareService>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<DialogShareListComponent>>;
  let mockSnackBar: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    mockShareService = jasmine.createSpyObj('ShareService', [
      'lookupUserByEmail',
      'shareList',
    ]);
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    mockSnackBar = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [
        DialogShareListComponent,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        FormsModule,
        BrowserAnimationsModule,
        MatSnackBarModule,
      ],
      providers: [
        { provide: ShareService, useValue: mockShareService },
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { listId: 'list1' } },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DialogShareListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show error when email is empty', () => {
    component.email = '';
    component.onShare();

    expect(mockShareService.lookupUserByEmail).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('Please enter an email address');
  });

  it('should show error when user not found', () => {
    component.email = 'nobody@test.com';
    mockShareService.lookupUserByEmail.and.returnValue(of(null));

    component.onShare();

    expect(mockShareService.lookupUserByEmail).toHaveBeenCalledWith('nobody@test.com');
    expect(component.errorMessage).toBe('User not found. They must have logged in at least once.');
  });

  it('should share list and close dialog when user found', () => {
    component.email = 'alice@test.com';
    mockShareService.lookupUserByEmail.and.returnValue(of('aliceUid'));
    mockShareService.shareList.and.returnValue(of(undefined));

    component.onShare();

    expect(mockShareService.shareList).toHaveBeenCalledWith(
      'list1',
      'aliceUid',
      'alice@test.com'
    );
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'List shared with alice@test.com',
      'OK',
      jasmine.any(Object)
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test --no-watch --browsers=ChromeHeadless --include=src/app/views/list/dialog-share-list/dialog-share-list.component.spec.ts`
Expected: FAIL - Cannot find module

- [ ] **Step 3: Implement the dialog component**

```typescript
// src/app/views/list/dialog-share-list/dialog-share-list.component.ts
import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MaterialModule } from 'src/app/material.module';
import { ShareService } from '../../../services/share.service';

@Component({
  selector: 'dialog-share-list',
  templateUrl: './dialog-share-list.component.html',
  styleUrls: ['./dialog-share-list.component.scss'],
  standalone: true,
  imports: [CommonModule, FormsModule, MaterialModule, MatDialogModule],
})
export class DialogShareListComponent {
  email = '';
  errorMessage = '';
  loading = false;

  constructor(
    private shareService: ShareService,
    private snackBar: MatSnackBar,
    private dialogRef: MatDialogRef<DialogShareListComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { listId: string }
  ) {}

  onShare(): void {
    this.errorMessage = '';

    if (!this.email.trim()) {
      this.errorMessage = 'Please enter an email address';
      return;
    }

    this.loading = true;
    const email = this.email.trim();

    this.shareService.lookupUserByEmail(email).subscribe((uid) => {
      if (!uid) {
        this.errorMessage = 'User not found. They must have logged in at least once.';
        this.loading = false;
        return;
      }

      this.shareService.shareList(this.data.listId, uid, email).subscribe(() => {
        this.loading = false;
        this.snackBar.open(`List shared with ${email}`, 'OK', { duration: 3000 });
        this.dialogRef.close(true);
      });
    });
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}
```

```html
<!-- src/app/views/list/dialog-share-list/dialog-share-list.component.html -->
<h2 mat-dialog-title>Share List</h2>
<mat-dialog-content>
  <mat-form-field appearance="outline" class="full-width">
    <mat-label>Email address</mat-label>
    <input matInput [(ngModel)]="email" type="email" placeholder="friend@example.com" />
  </mat-form-field>
  <p class="error-message" *ngIf="errorMessage">{{ errorMessage }}</p>
</mat-dialog-content>
<mat-dialog-actions align="end">
  <button mat-button (click)="onCancel()">Cancel</button>
  <button mat-raised-button color="primary" (click)="onShare()" [disabled]="loading">
    <span *ngIf="!loading">Share</span>
    <mat-spinner *ngIf="loading" diameter="20"></mat-spinner>
  </button>
</mat-dialog-actions>
```

```scss
// src/app/views/list/dialog-share-list/dialog-share-list.component.scss
.full-width {
  width: 100%;
}

.error-message {
  color: #f44336;
  font-size: 12px;
  margin-top: -8px;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `yarn test --no-watch --browsers=ChromeHeadless --include=src/app/views/list/dialog-share-list/dialog-share-list.component.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/views/list/dialog-share-list/
git commit -m "feat: create share list dialog component"
```

---

### Task 5: Add share button to the list view

Add a share icon button next to the list title that opens the share dialog.

**Files:**
- Modify: `src/app/views/list/list.component.ts`
- Modify: `src/app/views/list/list.component.html`
- Modify: `src/app/views/list/list.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to the existing `src/app/views/list/list.component.spec.ts`:

```typescript
// Add this import at the top
import { DialogShareListComponent } from './dialog-share-list/dialog-share-list.component';

// Add this test block inside the describe('ListComponent', ...) block, after the existing tests:

  // --- share button ---

  it('should open share dialog when share button is clicked', () => {
    const dialogRef = jasmine.createSpyObj('MatDialogRef', ['afterClosed']);
    dialogRef.afterClosed.and.returnValue(of(false));
    spyOn(component.dialog, 'open').and.returnValue(dialogRef);

    component.openShareDialog();

    expect(component.dialog.open).toHaveBeenCalledWith(
      DialogShareListComponent,
      jasmine.objectContaining({
        width: '300px',
        data: { listId: 'list1' },
      })
    );
  });

  it('should not open share dialog when list is undefined', () => {
    component.list = undefined;
    spyOn(component.dialog, 'open');

    component.openShareDialog();

    expect(component.dialog.open).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test --no-watch --browsers=ChromeHeadless --include=src/app/views/list/list.component.spec.ts`
Expected: FAIL - `openShareDialog` is not a function

- [ ] **Step 3: Add openShareDialog method to list.component.ts**

Add the import at the top of `src/app/views/list/list.component.ts`:

```typescript
import { DialogShareListComponent } from './dialog-share-list/dialog-share-list.component';
```

Add this method inside the `ListComponent` class:

```typescript
  openShareDialog(): void {
    if (!this.list) return;
    this.dialog.open(DialogShareListComponent, {
      width: '300px',
      data: { listId: this.list.id },
    });
  }
```

- [ ] **Step 4: Add the share button to the template**

In `src/app/views/list/list.component.html`, modify the `button-row` div to add a share button:

```html
  <div class="button-row">
    <h1 class="title">{{ list?.title }}</h1>
    <button (click)="openShareDialog()" mat-icon-button title="Share list">
      <mat-icon>share</mat-icon>
    </button>
    <button (click)="openDialogAddGroup()" mat-icon-button>
      <mat-icon>add</mat-icon>
    </button>
  </div>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `yarn test --no-watch --browsers=ChromeHeadless --include=src/app/views/list/list.component.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/views/list/list.component.ts src/app/views/list/list.component.html src/app/views/list/list.component.spec.ts
git commit -m "feat: add share button to list view"
```

---

### Task 6: Display shared lists on the lists view

Show shared lists in a "Shared with me" section below the user's personal lists.

**Files:**
- Modify: `src/app/views/lists/lists.component.ts`
- Modify: `src/app/views/lists/lists.component.html`
- Modify: `src/app/views/lists/lists.component.scss`
- Modify: `src/app/views/lists/lists.component.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add to the existing `src/app/views/lists/lists.component.spec.ts`:

```typescript
// Add this import at the top
import { ShareService } from '../../services/share.service';

// In the beforeEach, add the mockShareService:
// (after mockListService setup)
let mockShareService: jasmine.SpyObj<ShareService>;

// Inside beforeEach async:
mockShareService = jasmine.createSpyObj('ShareService', ['getSharedLists']);
mockShareService.getSharedLists.and.returnValue(of([]));

// Add to providers array:
{ provide: ShareService, useValue: mockShareService },

// Add these tests inside the describe block:

  // --- shared lists ---

  it('should load shared lists on init', () => {
    expect(mockShareService.getSharedLists).toHaveBeenCalled();
  });

  it('should display shared lists when present', () => {
    const sharedLists = [
      { id: 'sl1', title: 'Shared Trip', sections: [], ownerEmail: 'friend@test.com', isShared: true },
    ];
    mockShareService.getSharedLists.and.returnValue(of(sharedLists as any));

    // Re-trigger ngOnInit
    component.ngOnInit();

    expect(component.sharedLists.length).toBe(1);
    expect(component.sharedLists[0].title).toBe('Shared Trip');
  });

  it('should navigate to shared list with shared prefix', () => {
    component.onClickSharedList('sl1');
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      ['shared', 'sl1'],
      jasmine.any(Object)
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test --no-watch --browsers=ChromeHeadless --include=src/app/views/lists/lists.component.spec.ts`
Expected: FAIL - `sharedLists` and `onClickSharedList` do not exist

- [ ] **Step 3: Implement shared lists in lists.component.ts**

```typescript
// src/app/views/lists/lists.component.ts
import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { ShareService } from '../../services/share.service';
import { ListService } from '../list/list.service';
import { DialogAddListComponent } from './dialog-add-list/dialog-add-list.component';
import { List } from './list';

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

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    public dialog: MatDialog,
    private listService: ListService,
    private shareService: ShareService
  ) {}

  ngOnInit(): void {
    this.listService.getLists().subscribe((lists) => (this.lists = lists));
    this.shareService.getSharedLists().subscribe((lists) => (this.sharedLists = lists));
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
    const listId = event.item.data;
    if (listId) {
      this.listService.deleteList(listId).subscribe();
    }
  }

  dropList(_event: CdkDragDrop<any>) {}

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
```

- [ ] **Step 4: Update the template to show shared lists**

```html
<!-- src/app/views/lists/lists.component.html -->
<div cdkDropListGroup>
  <span
    cdkDropList
    (cdkDropListDropped)="dropTrash($event)"
    class="material-icons trash-icon"
    >restore_from_trash</span
  >

  <div class="button-row">
    <h1>Lists</h1>
    <button (click)="openDialogAddList()" mat-icon-button>
      <mat-icon>add</mat-icon>
    </button>
  </div>

  <mat-list
    role="list"
    cdkDropList
    id="lists-container"
    (cdkDropListDropped)="dropList($event)"
  >
    <mat-list-item
      *ngFor="let list of lists"
      cdkDrag
      [cdkDragData]="list.id"
      (click)="onClickList(list.id)"
    >
      <mat-icon cdkDragHandle class="drag-handle">drag_indicator</mat-icon>
      <span class="list-title">{{ list.title }}</span>
    </mat-list-item>
  </mat-list>

  <div *ngIf="sharedLists.length > 0" class="shared-section">
    <h2 class="shared-heading">Shared with me</h2>
    <mat-list role="list">
      <mat-list-item
        *ngFor="let list of sharedLists"
        (click)="onClickSharedList(list.id)"
      >
        <mat-icon class="shared-icon">people</mat-icon>
        <span class="list-title">{{ list.title }}</span>
        <span class="shared-owner">by {{ list.ownerEmail }}</span>
      </mat-list-item>
    </mat-list>
  </div>
</div>
```

- [ ] **Step 5: Add styles for the shared section**

Append to `src/app/views/lists/lists.component.scss`:

```scss
.shared-section {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #e2e8f0;
}

.shared-heading {
  font-size: 14px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 8px 8px;
}

.shared-icon {
  color: #3f51b5;
  font-size: 20px;
  margin-right: 8px;
}

.shared-owner {
  font-size: 12px;
  color: #94a3b8;
  margin-left: auto;
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `yarn test --no-watch --browsers=ChromeHeadless --include=src/app/views/lists/lists.component.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/views/lists/lists.component.ts src/app/views/lists/lists.component.html src/app/views/lists/lists.component.scss src/app/views/lists/lists.component.spec.ts
git commit -m "feat: display shared lists in lists view"
```

---

### Task 7: Add shared list route and update ListService for shared lists

Add a `shared/:id` route that reads from `sharedLists/` instead of `users/{uid}/lists/`.

**Files:**
- Modify: `src/app/app-routing.module.ts`
- Modify: `src/app/views/list/list.service.ts`
- Modify: `src/app/views/list/list.component.ts`

- [ ] **Step 1: Write the failing test for ListService shared list methods**

Create or update `src/app/views/list/list.service.spec.ts`:

```typescript
// src/app/views/list/list.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { of } from 'rxjs';
import { ListService } from './list.service';
import { AuthService } from '../../services/auth.service';

describe('ListService', () => {
  let service: ListService;
  let mockDb: jasmine.SpyObj<AngularFireDatabase>;
  let mockDbObject: jasmine.SpyObj<any>;
  let mockDbList: jasmine.SpyObj<any>;

  beforeEach(() => {
    mockDbObject = jasmine.createSpyObj('AngularFireObject', [
      'valueChanges',
      'update',
    ]);
    mockDbList = jasmine.createSpyObj('AngularFireList', [
      'snapshotChanges',
      'push',
      'remove',
    ]);

    mockDb = jasmine.createSpyObj('AngularFireDatabase', ['object', 'list']);
    mockDb.object.and.returnValue(mockDbObject);
    mockDb.list.and.returnValue(mockDbList);

    const mockAuth = {
      user$: of({ uid: 'testUid', email: 'test@test.com' }),
    };

    TestBed.configureTestingModule({
      providers: [
        ListService,
        { provide: AngularFireDatabase, useValue: mockDb },
        { provide: AuthService, useValue: mockAuth },
      ],
    });
    service = TestBed.inject(ListService);
  });

  describe('getSharedList', () => {
    it('should read from sharedLists path', (done) => {
      mockDbObject.valueChanges.and.returnValue(
        of({ title: 'Shared Trip', sections: {}, ownerEmail: 'friend@test.com' })
      );

      service.getSharedList('sharedId1').subscribe((list) => {
        expect(mockDb.object).toHaveBeenCalledWith('sharedLists/sharedId1');
        expect(list?.title).toBe('Shared Trip');
        expect(list?.isShared).toBeTrue();
        done();
      });
    });

    it('should return undefined when shared list does not exist', (done) => {
      mockDbObject.valueChanges.and.returnValue(of(null));

      service.getSharedList('nonexistent').subscribe((list) => {
        expect(list).toBeUndefined();
        done();
      });
    });
  });

  describe('updateSharedSectionItems', () => {
    it('should update items at sharedLists path', (done) => {
      mockDbObject.update.and.returnValue(Promise.resolve());

      service
        .updateSharedSectionItems('sharedId1', 'sec1', ['item1', 'item2'])
        .subscribe(() => {
          expect(mockDb.object).toHaveBeenCalledWith(
            'sharedLists/sharedId1/sections/sec1'
          );
          expect(mockDbObject.update).toHaveBeenCalledWith({
            items: ['item1', 'item2'],
          });
          done();
        });
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test --no-watch --browsers=ChromeHeadless --include=src/app/views/list/list.service.spec.ts`
Expected: FAIL - `getSharedList` is not a function

- [ ] **Step 3: Add shared list methods to ListService**

Add these methods to `src/app/views/list/list.service.ts`:

```typescript
  getSharedList(id: string): Observable<List | undefined> {
    return this.db
      .object(`sharedLists/${id}`)
      .valueChanges()
      .pipe(
        map((data: any) => {
          if (!data) return undefined;
          return {
            id,
            title: data.title,
            sections: this.parseSections(data.sections),
            ownerUid: data.ownerUid,
            ownerEmail: data.ownerEmail,
            sharedWith: data.sharedWith,
            isShared: true,
          } as List;
        })
      );
  }

  updateSharedSectionItems(
    listId: string,
    sectionId: string,
    items: string[]
  ): Observable<void> {
    return from(
      this.db
        .object(`sharedLists/${listId}/sections/${sectionId}`)
        .update({ items })
    );
  }
```

- [ ] **Step 4: Add the shared route**

In `src/app/app-routing.module.ts`, add a new route:

```typescript
const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: MainMenuComponent, canActivate: [AuthGuard] },
  { path: 'group', component: GroupComponent, canActivate: [AuthGuard] },
  { path: 'list', component: ListsComponent, canActivate: [AuthGuard] },
  { path: 'list/:id', component: ListComponent, canActivate: [AuthGuard] },
  { path: 'list/shared/:id', component: ListComponent, canActivate: [AuthGuard], data: { shared: true } },
];
```

- [ ] **Step 5: Update ListComponent to detect shared mode from route data**

In `src/app/views/list/list.component.ts`, modify `ngOnInit`:

```typescript
  ngOnInit(): void {
    this.route.data.subscribe((data) => {
      this.isShared = !!data['shared'];
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        const listObs = this.isShared
          ? this.listService.getSharedList(id)
          : this.listService.getList(id);
        listObs.subscribe((list) => {
          this.list = list;
        });
      }
    });
  }
```

Add the property to the class:

```typescript
  isShared = false;
```

Also update `onAddItemToSection` and `dropItem` to use the shared update path when `isShared` is true:

```typescript
  private updateItems(sectionId: string, items: string[]): void {
    if (!this.list) return;
    const obs = this.isShared
      ? this.listService.updateSharedSectionItems(this.list.id, sectionId, items)
      : this.listService.updateSectionItems(this.list.id, sectionId, items);
    obs.subscribe();
  }
```

Replace all `this.listService.updateSectionItems(this.list.id, ...)` calls with `this.updateItems(...)`.

- [ ] **Step 6: Run all tests**

Run: `yarn test --no-watch --browsers=ChromeHeadless`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/app-routing.module.ts src/app/views/list/list.service.ts src/app/views/list/list.service.spec.ts src/app/views/list/list.component.ts
git commit -m "feat: add shared list route and ListService shared methods"
```

---

### Task 8: Final integration test and cleanup

- [ ] **Step 1: Run all tests**

Run: `yarn test --no-watch --browsers=ChromeHeadless`
Expected: All PASS

- [ ] **Step 2: Manual smoke test**

Run: `yarn start`

Verify:
1. Login with a test account -> email-to-UID mapping is written to Firebase
2. Create a list -> appears in "Lists" section
3. Open the list -> share icon visible in header
4. Click share -> dialog opens, enter another user's email
5. Login as the other user -> "Shared with me" section shows the shared list
6. Click the shared list -> opens and edits propagate to both users

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "feat: shared lists feature complete"
```

---

Plan complete and saved to `docs/superpowers/plans/2026-04-05-shared-lists.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?