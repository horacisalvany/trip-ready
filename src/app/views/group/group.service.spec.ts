import { TestBed } from '@angular/core/testing';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { BehaviorSubject, of } from 'rxjs';
import { GroupService } from './group.service';
import { AuthService } from '../../services/auth.service';

describe('GroupService', () => {
  let service: GroupService;
  let mockDb: jasmine.SpyObj<AngularFireDatabase>;
  let mockDbList: jasmine.SpyObj<any>;

  beforeEach(() => {
    mockDbList = jasmine.createSpyObj('AngularFireList', [
      'snapshotChanges',
      'update',
      'push',
      'remove',
    ]);

    mockDb = jasmine.createSpyObj('AngularFireDatabase', ['object', 'list']);
    mockDb.list.and.returnValue(mockDbList);

    const mockAuth = {
      user$: of({ uid: 'testUid', email: 'test@test.com' }),
    };

    TestBed.configureTestingModule({
      providers: [
        GroupService,
        { provide: AngularFireDatabase, useValue: mockDb },
        { provide: AuthService, useValue: mockAuth },
      ],
    });
    service = TestBed.inject(GroupService);
  });

  describe('renameGroup', () => {
    /*
      `update` with the title alone rather than `set`, so the group keeps its
      items. The id is the Firebase key and is untouched by a rename.
     */
    it('should update only the title under the user groups path', (done) => {
      mockDbList.update.and.returnValue(Promise.resolve());

      service.renameGroup('g1', 'Beach gear').subscribe(() => {
        expect(mockDb.list).toHaveBeenCalledWith('users/testUid/groups');
        expect(mockDbList.update).toHaveBeenCalledWith('g1', {
          title: 'Beach gear',
        });
        done();
      });
    });

    /*
      The write rule in CLAUDE.md. user$ is long lived, so a rename left
      subscribed would be replayed under the next user's path the moment someone
      else logs in, renaming a group in their account.
     */
    it('should write once even when the auth user changes afterwards', () => {
      const user$ = new BehaviorSubject<{ uid: string } | null>({
        uid: 'testUid',
      });
      const isolatedService = new GroupService(mockDb, { user$ } as any);
      mockDbList.update.and.returnValue(Promise.resolve());

      isolatedService.renameGroup('g1', 'Beach gear').subscribe();
      user$.next({ uid: 'otherUid' });

      expect(mockDbList.update).toHaveBeenCalledTimes(1);
      expect(mockDb.list).not.toHaveBeenCalledWith('users/otherUid/groups');
    });

    it('should write nothing when nobody is logged in', (done) => {
      const isolatedService = new GroupService(mockDb, {
        user$: of(null),
      } as any);

      isolatedService.renameGroup('g1', 'Beach gear').subscribe(() => {
        expect(mockDbList.update).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
