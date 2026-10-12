import { Suggestion } from '../../../services/recommender.service';
import { unmarkedItems } from '../item';
import { Section } from '../section';
import { MAX_SUGGESTIONS, matchSection, visibleSuggestions } from './suggestions';

const SECTIONS: Section[] = [
  { id: 's1', title: 'Clothes', items: unmarkedItems(['Ski jacket', 'Thermal socks']) },
  { id: 's2', title: ' Documents ', items: unmarkedItems(['Passport']) },
];

function suggestion(name: string, section = 'Clothes'): Suggestion {
  return { name, section, reason: 'Because.' };
}

describe('matchSection', () => {
  it('should match a section by its exact name', () => {
    expect(matchSection(SECTIONS, 'Clothes')?.id).toBe('s1');
  });

  it('should match regardless of case', () => {
    expect(matchSection(SECTIONS, 'cLoThEs')?.id).toBe('s1');
  });

  it('should match regardless of surrounding whitespace on either side', () => {
    expect(matchSection(SECTIONS, '  clothes ')?.id).toBe('s1');
    expect(matchSection(SECTIONS, 'Documents')?.id).toBe('s2');
  });

  it('should match nothing when no section has that name', () => {
    expect(matchSection(SECTIONS, 'Toiletries')).toBeUndefined();
  });

  /* A partial name is a different section, not a near miss to be merged. */
  it('should not match on part of a name', () => {
    expect(matchSection(SECTIONS, 'Cloth')).toBeUndefined();
  });
});

describe('visibleSuggestions', () => {
  it('should keep suggestions that are not on the list, in order', () => {
    const suggestions = [suggestion('Ski gloves'), suggestion('Sunscreen', 'Toiletries')];

    expect(visibleSuggestions(suggestions, SECTIONS)).toEqual(suggestions);
  });

  /*
    The service filters these too, but the rule is the app's: a suggestion
    never repeats an item already on the list, in any section.
   */
  it('should drop a suggestion already on the list, in any case and any section', () => {
    const suggestions = [
      suggestion(' ski JACKET '),
      suggestion('passport', 'Clothes'),
      suggestion('Ski gloves'),
    ];

    expect(visibleSuggestions(suggestions, SECTIONS).map((s) => s.name)).toEqual([
      'Ski gloves',
    ]);
  });

  it('should show at most 10 suggestions', () => {
    const suggestions = Array.from({ length: 12 }, (_, i) => suggestion(`Item ${i}`));

    const visible = visibleSuggestions(suggestions, SECTIONS);

    expect(MAX_SUGGESTIONS).toBe(10);
    expect(visible.length).toBe(10);
    expect(visible[9].name).toBe('Item 9');
  });

  it('should cap after dropping duplicates, not before', () => {
    const suggestions = [
      suggestion('Passport'),
      ...Array.from({ length: 10 }, (_, i) => suggestion(`Item ${i}`)),
    ];

    expect(visibleSuggestions(suggestions, SECTIONS).length).toBe(10);
  });
});
