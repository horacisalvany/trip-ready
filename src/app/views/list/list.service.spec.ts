import { TestBed } from '@angular/core/testing';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { BehaviorSubject, of } from 'rxjs';
import { ListService } from './list.service';
import { AuthService } from '../../services/auth.service';
import { parseItems } from './item';

describe('ListService', () => {
  let service: ListService;
  let mockDb: jasmine.SpyObj<AngularFireDatabase>;
  let mockDbObject: jasmine.SpyObj<any>;

  beforeEach(() => {
    mockDbObject = jasmine.createSpyObj('AngularFireObject', [
      'valueChanges',
      'update',
      'set',
    ]);

    mockDb = jasmine.createSpyObj('AngularFireDatabase', ['object', 'list']);
    mockDb.object.and.returnValue(mockDbObject);

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

  describe('getLists', () => {
    it('should exclude lists whose IDs appear in sharedListIds', (done) => {
      const mockListRef = jasmine.createSpyObj('AngularFireList', ['snapshotChanges']);
      const mockSharedIdsObj = jasmine.createSpyObj('AngularFireObject', ['valueChanges']);

      mockListRef.snapshotChanges.and.returnValue(of([
        { payload: { key: 'l1', val: () => ({ title: 'My Trip', sections: {} }) } },
        { payload: { key: 'shared1', val: () => ({ title: 'Ghost', sections: {} }) } },
      ]));
      mockSharedIdsObj.valueChanges.and.returnValue(of({ shared1: true }));

      mockDb.list.and.returnValue(mockListRef);
      mockDb.object.and.callFake((path: string) => {
        if (path === 'users/testUid/sharedListIds') return mockSharedIdsObj;
        return mockDbObject;
      });

      service.getLists().subscribe((lists) => {
        expect(lists.length).toBe(1);
        expect(lists[0].id).toBe('l1');
        expect(lists[0].title).toBe('My Trip');
        done();
      });
    });

    it('should return all lists when no sharedListIds exist', (done) => {
      const mockListRef = jasmine.createSpyObj('AngularFireList', ['snapshotChanges']);
      const mockSharedIdsObj = jasmine.createSpyObj('AngularFireObject', ['valueChanges']);

      mockListRef.snapshotChanges.and.returnValue(of([
        { payload: { key: 'l1', val: () => ({ title: 'Trip A', sections: {} }) } },
        { payload: { key: 'l2', val: () => ({ title: 'Trip B', sections: {} }) } },
      ]));
      mockSharedIdsObj.valueChanges.and.returnValue(of(null));

      mockDb.list.and.returnValue(mockListRef);
      mockDb.object.and.callFake((path: string) => {
        if (path === 'users/testUid/sharedListIds') return mockSharedIdsObj;
        return mockDbObject;
      });

      service.getLists().subscribe((lists) => {
        expect(lists.length).toBe(2);
        done();
      });
    });
  });

  describe('addEmptySectionToList', () => {
    it('should push a titled section with no items under the user lists path', (done) => {
      const mockListRef = jasmine.createSpyObj('AngularFireList', ['push']);
      mockListRef.push.and.returnValue(Promise.resolve({ key: 'newSectionKey' }));
      mockDb.list.and.returnValue(mockListRef);

      service.addEmptySectionToList('l1', 'Beach gear').subscribe((key) => {
        expect(mockDb.list).toHaveBeenCalledWith('users/testUid/lists/l1/sections');
        expect(mockListRef.push).toHaveBeenCalledWith({
          title: 'Beach gear',
          items: [],
        });
        expect(key).toBe('newSectionKey');
        done();
      });
    });
  });

  describe('addEmptySharedSectionToList', () => {
    it('should push a titled section with no items under the sharedLists path', (done) => {
      const mockListRef = jasmine.createSpyObj('AngularFireList', ['push']);
      mockListRef.push.and.returnValue(Promise.resolve({ key: 'newSectionKey' }));
      mockDb.list.and.returnValue(mockListRef);

      service
        .addEmptySharedSectionToList('sharedId1', 'Beach gear')
        .subscribe((key) => {
          expect(mockDb.list).toHaveBeenCalledWith('sharedLists/sharedId1/sections');
          expect(mockListRef.push).toHaveBeenCalledWith({
            title: 'Beach gear',
            items: [],
          });
          expect(key).toBe('newSectionKey');
          done();
        });
    });
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

    /*
      A recipient reads the owner's marks through this method, so it has to run
      items through parseItems the same way getList does. Asserted here rather
      than inferred from both sharing parseSections: ShareService kept its own
      copy of parseSections once already, so an inlined mapping here would drop
      every recipient's marks with nothing else to catch it. The legacy string
      alongside the marked item covers the shared path's normalisation too.
     */
    it('should keep the marks stored on a shared list', (done) => {
      mockDbObject.valueChanges.and.returnValue(
        of({
          title: 'Shared Trip',
          sections: {
            s1: {
              title: 'Packing',
              items: [{ name: 'Passport', checked: true }, 'Tickets'],
            },
          },
        })
      );

      service.getSharedList('sharedId1').subscribe((list) => {
        expect(list!.sections[0].items).toEqual([
          { name: 'Passport', checked: true },
          { name: 'Tickets', checked: false },
        ]);
        done();
      });
    });
  });

  describe('updateSharedSectionItems', () => {
    it('should update items at sharedLists path', (done) => {
      mockDbObject.update.and.returnValue(Promise.resolve());

      service
        .updateSharedSectionItems('sharedId1', 'sec1', [
          { name: 'item1', checked: false },
          { name: 'item2', checked: true },
        ])
        .subscribe(() => {
          expect(mockDb.object).toHaveBeenCalledWith('sharedLists/sharedId1/sections/sec1');
          expect(mockDbObject.update).toHaveBeenCalledWith({
            items: [
              { name: 'item1', checked: false },
              { name: 'item2', checked: true },
            ],
          });
          done();
        });
    });
  });

  describe('addSharedSectionToList', () => {
    it('should push section to sharedLists path', (done) => {
      const mockListRef = jasmine.createSpyObj('AngularFireList', ['push']);
      mockListRef.push.and.returnValue(Promise.resolve({ key: 'newSectionKey' }));
      mockDb.list.and.returnValue(mockListRef);

      const group = { id: 'g1', title: 'Clothes', items: ['shirt', 'pants'] };

      service.addSharedSectionToList('sharedId1', group).subscribe((key) => {
        expect(mockDb.list).toHaveBeenCalledWith('sharedLists/sharedId1/sections');
        expect(mockListRef.push).toHaveBeenCalledWith({
          title: 'Clothes',
          items: [
            { name: 'shirt', checked: false },
            { name: 'pants', checked: false },
          ],
          sourceGroupId: 'g1',
        });
        expect(key).toBe('newSectionKey');
        done();
      });
    });
  });

  describe('addSectionToList', () => {
    /*
      A section built from a group starts unmarked: a group is a template and
      carries no marks.
     */
    it('should add a section from a group with every item unmarked', (done) => {
      const mockListRef = jasmine.createSpyObj('AngularFireList', ['push']);
      mockListRef.push.and.returnValue(Promise.resolve({ key: 'newKey' }));
      mockDb.list.and.returnValue(mockListRef);

      service
        .addSectionToList('l1', { id: 'g1', title: 'Clothes', items: ['shirt', 'pants'] })
        .subscribe(() => {
          expect(mockListRef.push).toHaveBeenCalledWith({
            title: 'Clothes',
            items: [
              { name: 'shirt', checked: false },
              { name: 'pants', checked: false },
            ],
            sourceGroupId: 'g1',
          });
          done();
        });
    });
  });

  describe('getList item parsing', () => {
    function emitStoredList(sections: any) {
      mockDbObject.valueChanges.and.returnValue(of({ title: 'Trip', sections }));
    }

    /*
      Data written before F08 is still on every existing account, and nothing
      migrates it: a bare string reads as an unmarked item.
     */
    it('should read items stored as plain strings as unmarked items', (done) => {
      emitStoredList({ s1: { title: 'Packing', items: ['Passport', 'Tickets'] } });

      service.getList('l1').subscribe((list) => {
        expect(list!.sections[0].items).toEqual([
          { name: 'Passport', checked: false },
          { name: 'Tickets', checked: false },
        ]);
        done();
      });
    });

    it('should keep the marks of items stored as objects', (done) => {
      emitStoredList({
        s1: {
          title: 'Packing',
          items: [
            { name: 'Passport', checked: true },
            { name: 'Tickets', checked: false },
          ],
        },
      });

      service.getList('l1').subscribe((list) => {
        expect(list!.sections[0].items).toEqual([
          { name: 'Passport', checked: true },
          { name: 'Tickets', checked: false },
        ]);
        done();
      });
    });

    /*
      Firebase's SDK falls back to a keyed object once a list's integer keys
      are sparse enough. See parseItems for how this shape can arise.
     */
    it('should read items returned as a keyed object', (done) => {
      emitStoredList({ s1: { title: 'Packing', items: { 0: 'Passport', 2: 'Hat' } } });

      service.getList('l1').subscribe((list) => {
        expect(list!.sections[0].items).toEqual([
          { name: 'Passport', checked: false },
          { name: 'Hat', checked: false },
        ]);
        done();
      });
    });

    it('should read a section with no items as an empty list', (done) => {
      emitStoredList({ s1: { title: 'Packing' } });

      service.getList('l1').subscribe((list) => {
        expect(list!.sections[0].items).toEqual([]);
        done();
      });
    });

    /*
      Firebase's SDK renders a sparse array with null gaps while the integer
      keys are still dense enough, and only falls back to a keyed object below
      that threshold, so the same gap reaches us as either shape.
     */
    it('should drop null holes in a sparse array', (done) => {
      emitStoredList({ s1: { title: 'Packing', items: ['Passport', null, 'Hat'] } });

      service.getList('l1').subscribe((list) => {
        expect(list!.sections[0].items).toEqual([
          { name: 'Passport', checked: false },
          { name: 'Hat', checked: false },
        ]);
        done();
      });
    });

    /*
      A stored object with no usable name — missing, empty, or not a string —
      is unreadable and undeletable by drag: the row would be blank and have
      nothing to grab. 'Untitled' matches the fallback parseSections already
      uses for a section with no title.
     */
    it('should fall back to Untitled for a stored item with no usable name', (done) => {
      emitStoredList({
        s1: {
          title: 'Packing',
          items: [
            { checked: true },
            { name: '', checked: false },
            { name: 42, checked: false },
          ],
        },
      });

      service.getList('l1').subscribe((list) => {
        expect(list!.sections[0].items).toEqual([
          { name: 'Untitled', checked: true },
          { name: 'Untitled', checked: false },
          { name: 'Untitled', checked: false },
        ]);
        done();
      });
    });

    /*
      parseSections already guards against a scalar at the node; parseItems
      needs the same guard, or a bare string like items: 'Passport' reaches
      Object.values and explodes into one item per character.
     */
    it('should read a scalar items node as an empty list', (done) => {
      emitStoredList({ s1: { title: 'Packing', items: 'Passport' } });

      service.getList('l1').subscribe((list) => {
        expect(list!.sections[0].items).toEqual([]);
        done();
      });
    });
  });

  describe('renameSection', () => {
    it('should update the title under the user lists path', (done) => {
      mockDbObject.update.and.returnValue(Promise.resolve());

      service.renameSection('l1', 'sec1', 'Beach gear').subscribe(() => {
        expect(mockDb.object).toHaveBeenCalledWith(
          'users/testUid/lists/l1/sections/sec1'
        );
        expect(mockDbObject.update).toHaveBeenCalledWith({ title: 'Beach gear' });
        done();
      });
    });

    /*
      The write rule in CLAUDE.md. user$ is long lived, so a rename left
      subscribed would be replayed under the next user's path the moment someone
      else logs in, renaming a section in their account.
     */
    it('should write once even when the auth user changes afterwards', () => {
      const user$ = new BehaviorSubject<{ uid: string } | null>({ uid: 'testUid' });
      const isolatedService = new ListService(mockDb, { user$ } as any);
      mockDbObject.update.and.returnValue(Promise.resolve());

      isolatedService.renameSection('l1', 'sec1', 'Beach gear').subscribe();
      user$.next({ uid: 'otherUid' });

      expect(mockDbObject.update).toHaveBeenCalledTimes(1);
      expect(mockDb.object).not.toHaveBeenCalledWith(
        'users/otherUid/lists/l1/sections/sec1'
      );
    });
  });

  describe('renameSharedSection', () => {
    it('should update the title at the sharedLists path', (done) => {
      mockDbObject.update.and.returnValue(Promise.resolve());

      service
        .renameSharedSection('sharedId1', 'sec1', 'Beach gear')
        .subscribe(() => {
          expect(mockDb.object).toHaveBeenCalledWith(
            'sharedLists/sharedId1/sections/sec1'
          );
          expect(mockDbObject.update).toHaveBeenCalledWith({
            title: 'Beach gear',
          });
          done();
        });
    });
  });

  describe('updateItemAt', () => {
    /* See updateItemAt: set heals the legacy string shape without losing the name. */
    it('should set the whole item at its index under the user lists path', (done) => {
      mockDbObject.set.and.returnValue(Promise.resolve());

      service
        .updateItemAt('l1', 'sec1', 2, { name: 'Passport', checked: true })
        .subscribe(() => {
          expect(mockDb.object).toHaveBeenCalledWith(
            'users/testUid/lists/l1/sections/sec1/items/2'
          );
          expect(mockDbObject.set).toHaveBeenCalledWith({
            name: 'Passport',
            checked: true,
          });
          done();
        });
    });

    /* The write rule in CLAUDE.md. */
    it('should write once even when the auth user changes afterwards', () => {
      const user$ = new BehaviorSubject<{ uid: string } | null>({ uid: 'testUid' });
      const isolatedService = new ListService(mockDb, { user$ } as any);
      mockDbObject.set.and.returnValue(Promise.resolve());

      isolatedService
        .updateItemAt('l1', 'sec1', 0, { name: 'Passport', checked: true })
        .subscribe();
      user$.next({ uid: 'otherUid' });

      expect(mockDbObject.set).toHaveBeenCalledTimes(1);
      expect(mockDb.object).not.toHaveBeenCalledWith(
        'users/otherUid/lists/l1/sections/sec1/items/0'
      );
    });

    /*
      A tap can race a logout: user$ emits null and userPath() yields no path.
      Matches every sibling method — complete silently, write nothing — since
      no caller inspects the result and a live stream would revert the row on
      the next emission anyway.
     */
    it('should complete without writing when the user is signed out', () => {
      const user$ = new BehaviorSubject<{ uid: string } | null>(null);
      const isolatedService = new ListService(mockDb, { user$ } as any);
      let completed = false;

      isolatedService
        .updateItemAt('l1', 'sec1', 0, { name: 'Passport', checked: true })
        .subscribe({ complete: () => (completed = true) });

      expect(mockDbObject.set).not.toHaveBeenCalled();
      expect(completed).toBeTrue();
    });

    /*
      Pins the hazard documented on parseItems and updateItemAt: a sparse
      stored node collapses position and key, so the index parseItems assigns
      is not the stored key. If this stops matching, parseItems changed to
      preserve keys and updateItemAt's index contract needs to change with it.
     */
    it('should write to the position parseItems assigned, not the original stored key, for a sparse node', (done) => {
      const items = parseItems({ 0: 'Passport', 2: 'Hat' });
      const hatIndex = items.findIndex((item) => item.name === 'Hat');
      expect(hatIndex).toBe(1); // stored under key 2, but parseItems compacts it to position 1
      mockDbObject.set.and.returnValue(Promise.resolve());

      service
        .updateItemAt('l1', 'sec1', hatIndex, { name: 'Hat', checked: true })
        .subscribe(() => {
          expect(mockDb.object).toHaveBeenCalledWith(
            'users/testUid/lists/l1/sections/sec1/items/1'
          );
          done();
        });
    });
  });

  describe('updateSharedItemAt', () => {
    it('should set the whole item at its index under the sharedLists path', (done) => {
      mockDbObject.set.and.returnValue(Promise.resolve());

      service
        .updateSharedItemAt('sharedId1', 'sec1', 0, { name: 'Milk', checked: true })
        .subscribe(() => {
          expect(mockDb.object).toHaveBeenCalledWith(
            'sharedLists/sharedId1/sections/sec1/items/0'
          );
          expect(mockDbObject.set).toHaveBeenCalledWith({ name: 'Milk', checked: true });
          done();
        });
    });
  });

  describe('removeSharedSectionFromList', () => {
    it('should remove section from sharedLists path', (done) => {
      const mockListRef = jasmine.createSpyObj('AngularFireList', ['remove']);
      mockListRef.remove.and.returnValue(Promise.resolve());
      mockDb.list.and.returnValue(mockListRef);

      service.removeSharedSectionFromList('sharedId1', 'sec1').subscribe(() => {
        expect(mockDb.list).toHaveBeenCalledWith('sharedLists/sharedId1/sections');
        expect(mockListRef.remove).toHaveBeenCalledWith('sec1');
        done();
      });
    });
  });
});
