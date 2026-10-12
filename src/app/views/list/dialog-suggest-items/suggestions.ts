import { Suggestion } from '../../../services/recommender.service';
import { Section } from '../section';

/** More than this is unusable in a dialog on a phone. The service caps it too. */
export const MAX_SUGGESTIONS = 10;

function normalised(name: string): string {
  return name.trim().toLowerCase();
}

/*
  The section a suggestion belongs in, or undefined when the list has none by
  that name — in which case accepting it creates one. Trimmed and
  case-insensitive, so "clothes " lands in "Clothes" rather than beside it.
 */
export function matchSection(sections: Section[], name: string): Section | undefined {
  const wanted = normalised(name);
  return sections.find((section) => normalised(section.title) === wanted);
}

/*
  What the dialog shows. The service already drops repeats and caps the count,
  but both are rules of the app, so they are enforced on the side that renders
  them as well — a service that drifts cannot show a user their own passport.
 */
export function visibleSuggestions(
  suggestions: Suggestion[],
  sections: Section[]
): Suggestion[] {
  const onList = new Set(
    sections.flatMap((section) => section.items.map((item) => normalised(item.name)))
  );
  return suggestions
    .filter((suggestion) => !onList.has(normalised(suggestion.name)))
    .slice(0, MAX_SUGGESTIONS);
}
