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

    // Create service instance without triggering constructor
    // (avoids @angular/fire Auth needing full Firebase app init)
    service = Object.create(AuthService.prototype);
    (service as any).db = mockDb;
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
