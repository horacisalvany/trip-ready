import { AngularFireDatabase } from '@angular/fire/compat/database';
import { of } from 'rxjs';
import { ShareService } from './share.service';
import { AuthService } from './auth.service';

describe('ShareService', () => {
  let service: ShareService;
  let mockDb: jasmine.SpyObj<AngularFireDatabase>;
  let mockAuthService: jasmine.SpyObj<AuthService>;
  let mockDbObject: jasmine.SpyObj<any>;

  beforeEach(() => {
    mockDbObject = jasmine.createSpyObj('AngularFireObject', [
      'valueChanges',
      'set',
      'remove',
    ]);
    mockDbObject.set.and.returnValue(Promise.resolve());
    mockDbObject.remove.and.returnValue(Promise.resolve());
    mockDbObject.valueChanges.and.returnValue(of(null));

    mockDb = jasmine.createSpyObj('AngularFireDatabase', ['object']);
    mockDb.object.and.returnValue(mockDbObject);

    mockAuthService = jasmine.createSpyObj('AuthService', ['sanitizeEmail'], {
      user$: of({ uid: 'ownerUid', email: 'owner@test.com' }),
    });
    mockAuthService.sanitizeEmail.and.callFake((email: string) =>
      email.replace(/\./g, ',')
    );

    service = Object.create(ShareService.prototype);
    (service as any).db = mockDb;
    (service as any).authService = mockAuthService;
  });

  describe('lookupUserByEmail', () => {
    it('should return uid when user is found', (done) => {
      mockDbObject.valueChanges.and.returnValue(of('targetUid123'));

      service.lookupUserByEmail('alice@example.com').subscribe((uid) => {
        expect(mockAuthService.sanitizeEmail).toHaveBeenCalledWith(
          'alice@example.com'
        );
        expect(mockDb.object).toHaveBeenCalledWith(
          'userEmails/alice@example,com'
        );
        expect(uid).toBe('targetUid123');
        done();
      });
    });

    it('should return null when user is not found', (done) => {
      mockDbObject.valueChanges.and.returnValue(of(null));

      service.lookupUserByEmail('nobody@example.com').subscribe((uid) => {
        expect(uid).toBeNull();
        done();
      });
    });
  });

  describe('shareList', () => {
    it('should write to the correct Firebase paths', (done) => {
      const listData = {
        title: 'Vacation',
        sections: {
          s1: { title: 'Clothes', items: ['shirt', 'pants'] },
        },
      };

      mockDb.object.and.callFake((path: string) => {
        const obj = jasmine.createSpyObj('AngularFireObject', [
          'valueChanges',
          'set',
          'remove',
        ]);
        obj.set.and.returnValue(Promise.resolve());
        obj.remove.and.returnValue(Promise.resolve());
        obj.valueChanges.and.returnValue(
          path === 'users/ownerUid/lists/list1' ? of(listData) : of(null)
        );
        return obj;
      });

      service.shareList('list1', 'targetUid', 'target@test.com').subscribe({
        next: () => {
          const paths = (mockDb.object as jasmine.Spy).calls
            .allArgs()
            .map((args: any[]) => args[0]);
          expect(paths).toContain('users/ownerUid/lists/list1');
          expect(paths).toContain('sharedLists/list1');
          expect(paths).toContain('users/ownerUid/sharedListIds/list1');
          expect(paths).toContain('users/targetUid/sharedListIds/list1');
          done();
        },
        error: done.fail,
      });
    });

    it('should merge the new recipient into sharedWith instead of overwriting the whole node when the list is already shared', (done) => {
      const existingSharedListData = {
        title: 'Beach Trip',
        sections: {
          s1: { title: 'Essentials', items: ['sunscreen'] },
        },
        ownerUid: 'ownerUid',
        ownerEmail: 'owner@test.com',
        sharedWith: { friendUid: 'friend@test.com' },
      };

      const objectsByPath = new Map<string, jasmine.SpyObj<any>>();

      mockDb.object.and.callFake((path: string) => {
        if (!objectsByPath.has(path)) {
          const obj = jasmine.createSpyObj('AngularFireObject', [
            'valueChanges',
            'set',
            'remove',
          ]);
          obj.set.and.returnValue(Promise.resolve());
          obj.remove.and.returnValue(Promise.resolve());
          obj.valueChanges.and.returnValue(
            path === 'sharedLists/list1' ? of(existingSharedListData) : of(null)
          );
          objectsByPath.set(path, obj);
        }
        return objectsByPath.get(path);
      });

      service.shareList('list1', 'newTargetUid', 'new@test.com').subscribe({
        next: () => {
          expect(
            objectsByPath.get('sharedLists/list1')?.set
          ).not.toHaveBeenCalled();
          expect(
            objectsByPath.get('sharedLists/list1/sharedWith/newTargetUid')?.set
          ).toHaveBeenCalledWith('new@test.com');
          expect(
            objectsByPath.get('users/newTargetUid/sharedListIds/list1')?.set
          ).toHaveBeenCalledWith(true);
          done();
        },
        error: done.fail,
      });
    });
  });

  describe('deleteSharedList', () => {
    it('should remove the shared list and all user references', (done) => {
      const sharedListData = {
        title: 'Beach Trip',
        ownerUid: 'ownerUid',
        ownerEmail: 'owner@test.com',
        sharedWith: { friendUid: 'friend@test.com' },
      };

      mockDb.object.and.callFake((path: string) => {
        const obj = jasmine.createSpyObj('AngularFireObject', [
          'valueChanges',
          'set',
          'remove',
        ]);
        obj.set.and.returnValue(Promise.resolve());
        obj.remove.and.returnValue(Promise.resolve());
        if (path === 'sharedLists/list1') {
          obj.valueChanges.and.returnValue(of(sharedListData));
        }
        return obj;
      });

      service.deleteSharedList('list1').subscribe({
        next: () => {
          const paths = (mockDb.object as jasmine.Spy).calls
            .allArgs()
            .map((args: any[]) => args[0]);
          expect(paths).toContain('sharedLists/list1');
          expect(paths).toContain('users/ownerUid/lists/list1');
          expect(paths).toContain('users/ownerUid/sharedListIds/list1');
          expect(paths).toContain('users/friendUid/sharedListIds/list1');
          done();
        },
        error: done.fail,
      });
    });
  });

  describe('getSharedLists', () => {
    it('should return empty array when no shared lists', (done) => {
      mockDbObject.valueChanges.and.returnValue(of(null));

      service.getSharedLists().subscribe((lists) => {
        expect(lists).toEqual([]);
        done();
      });
    });

    it('should return parsed lists when present', (done) => {
      const sharedListIds = { list1: true, list2: true };
      const sharedListData1 = {
        title: 'Beach Trip',
        sections: {
          s1: { title: 'Essentials', items: ['sunscreen'] },
        },
        ownerUid: 'someoneElse',
        ownerEmail: 'someone@test.com',
        sharedWith: { ownerUid: 'owner@test.com' },
      };
      const sharedListData2 = {
        title: 'Mountain Trip',
        sections: {},
        ownerUid: 'anotherUser',
        ownerEmail: 'another@test.com',
        sharedWith: { ownerUid: 'owner@test.com' },
      };

      mockDb.object.and.callFake((path: string) => {
        const obj = jasmine.createSpyObj('AngularFireObject', [
          'valueChanges',
        ]);
        if (path === 'users/ownerUid/sharedListIds') {
          obj.valueChanges.and.returnValue(of(sharedListIds));
        } else if (path === 'sharedLists/list1') {
          obj.valueChanges.and.returnValue(of(sharedListData1));
        } else if (path === 'sharedLists/list2') {
          obj.valueChanges.and.returnValue(of(sharedListData2));
        }
        return obj;
      });

      service.getSharedLists().subscribe((lists) => {
        expect(lists.length).toBe(2);
        expect(lists[0].id).toBe('list1');
        expect(lists[0].title).toBe('Beach Trip');
        expect(lists[0].isShared).toBeTrue();
        expect(lists[0].sections.length).toBe(1);
        expect(lists[0].sections[0].title).toBe('Essentials');
        expect(lists[1].id).toBe('list2');
        expect(lists[1].title).toBe('Mountain Trip');
        expect(lists[1].isShared).toBeTrue();
        done();
      });
    });

    it('should include lists owned by the current user (collaborative mode)', (done) => {
      const sharedListIds = { list1: true, list2: true };
      const sharedListData1 = {
        title: 'My Shared List',
        sections: {},
        ownerUid: 'ownerUid',
        ownerEmail: 'owner@test.com',
        sharedWith: { friendUid: 'friend@test.com' },
      };
      const sharedListData2 = {
        title: 'Friend List',
        sections: {},
        ownerUid: 'friendUid',
        ownerEmail: 'friend@test.com',
        sharedWith: { ownerUid: 'owner@test.com' },
      };

      mockDb.object.and.callFake((path: string) => {
        const obj = jasmine.createSpyObj('AngularFireObject', [
          'valueChanges',
        ]);
        if (path === 'users/ownerUid/sharedListIds') {
          obj.valueChanges.and.returnValue(of(sharedListIds));
        } else if (path === 'sharedLists/list1') {
          obj.valueChanges.and.returnValue(of(sharedListData1));
        } else if (path === 'sharedLists/list2') {
          obj.valueChanges.and.returnValue(of(sharedListData2));
        }
        return obj;
      });

      service.getSharedLists().subscribe((lists) => {
        expect(lists.length).toBe(2);
        expect(lists[0].id).toBe('list1');
        expect(lists[0].title).toBe('My Shared List');
        expect(lists[1].id).toBe('list2');
        expect(lists[1].title).toBe('Friend List');
        done();
      });
    });
  });
});
