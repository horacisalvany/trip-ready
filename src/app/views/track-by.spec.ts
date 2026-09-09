import { trackById, trackByIndex } from './track-by';

describe('trackById', () => {
  it('keys an entity by its Firebase id', () => {
    expect(trackById(0, { id: 's1' })).toBe('s1');
  });

  it('ignores the position, so a reorder does not rebuild the row', () => {
    expect(trackById(0, { id: 's1' })).toBe(trackById(7, { id: 's1' }));
  });

  /*
    parseSections and parseItems build new objects on every emission, so the
    same thing arrives as a different object each time. That is the case this
    exists for.
   */
  it('keys two distinct objects with the same id alike', () => {
    expect(trackById(0, { id: 's1' })).toBe(trackById(0, { id: 's1' }));
  });
});

describe('trackByIndex', () => {
  it('keys an item by its position', () => {
    expect(trackByIndex(3)).toBe(3);
  });
});
