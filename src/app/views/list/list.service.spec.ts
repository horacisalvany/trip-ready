import { TestBed } from '@angular/core/testing';
import { AngularFireDatabase } from '@angular/fire/compat/database';
import { of } from 'rxjs';
import { ListService } from './list.service';
import { AuthService } from '../../services/auth.service';

describe('ListService', () => {
  let service: ListService;
  let mockDb: jasmine.SpyObj<AngularFireDatabase>;
  let mockDbObject: jasmine.SpyObj<any>;

  beforeEach(() => {
    mockDbObject = jasmine.createSpyObj('AngularFireObject', [
      'valueChanges',
      'update',
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
  });

  describe('updateSharedSectionItems', () => {
    it('should update items at sharedLists path', (done) => {
      mockDbObject.update.and.returnValue(Promise.resolve());

      service.updateSharedSectionItems('sharedId1', 'sec1', ['item1', 'item2']).subscribe(() => {
        expect(mockDb.object).toHaveBeenCalledWith('sharedLists/sharedId1/sections/sec1');
        expect(mockDbObject.update).toHaveBeenCalledWith({ items: ['item1', 'item2'] });
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
          items: ['shirt', 'pants'],
          sourceGroupId: 'g1',
        });
        expect(key).toBe('newSectionKey');
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
