import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { ShareService } from 'src/app/services/share.service';
import { DialogShareListComponent } from './dialog-share-list.component';

describe('DialogShareListComponent', () => {
  let component: DialogShareListComponent;
  let fixture: ComponentFixture<DialogShareListComponent>;
  let mockDialogRef: jasmine.SpyObj<MatDialogRef<DialogShareListComponent>>;
  let mockShareService: jasmine.SpyObj<ShareService>;
  let mockSnackBar: jasmine.SpyObj<MatSnackBar>;

  beforeEach(async () => {
    mockDialogRef = jasmine.createSpyObj('MatDialogRef', ['close']);
    mockShareService = jasmine.createSpyObj('ShareService', [
      'lookupUserByEmail',
      'shareList',
    ]);
    mockSnackBar = jasmine.createSpyObj('MatSnackBar', ['open']);

    await TestBed.configureTestingModule({
      imports: [DialogShareListComponent, FormsModule, NoopAnimationsModule],
      providers: [
        { provide: MatDialogRef, useValue: mockDialogRef },
        { provide: MAT_DIALOG_DATA, useValue: { listId: 'test-list-id' } },
        { provide: ShareService, useValue: mockShareService },
        { provide: MatSnackBar, useValue: mockSnackBar },
      ],
    }).compileComponents();

    TestBed.overrideComponent(DialogShareListComponent, {
      set: {
        providers: [
          { provide: ShareService, useValue: mockShareService },
          { provide: MatSnackBar, useValue: mockSnackBar },
        ],
      },
    });

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
    expect(component.errorMessage).toBe('Please enter an email address');
    expect(mockShareService.lookupUserByEmail).not.toHaveBeenCalled();
  });

  it('should show error when user not found', () => {
    mockShareService.lookupUserByEmail.and.returnValue(of(null));
    component.email = 'notfound@example.com';

    component.onShare();

    expect(mockShareService.lookupUserByEmail).toHaveBeenCalledWith(
      'notfound@example.com'
    );
    expect(component.errorMessage).toBe(
      'User not found. They must have logged in at least once.'
    );
    expect(component.loading).toBeFalse();
  });

  it('should share list and close dialog when user is found', () => {
    mockShareService.lookupUserByEmail.and.returnValue(of('target-uid'));
    mockShareService.shareList.and.returnValue(of(void 0));
    component.email = 'friend@example.com';

    component.onShare();

    expect(mockShareService.lookupUserByEmail).toHaveBeenCalledWith(
      'friend@example.com'
    );
    expect(mockShareService.shareList).toHaveBeenCalledWith(
      'test-list-id',
      'target-uid',
      'friend@example.com'
    );
    expect(mockSnackBar.open).toHaveBeenCalledWith(
      'List shared with friend@example.com',
      'OK',
      { duration: 3000 }
    );
    expect(mockDialogRef.close).toHaveBeenCalledWith(true);
  });
});
