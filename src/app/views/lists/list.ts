import { Section } from '../list/section';

export interface List {
  id: string;
  title: string;
  sections: Section[];
  /** Free-text context for the item recommender (F12), at most 200 characters. */
  tripNote?: string;
  ownerUid?: string;
  ownerEmail?: string;
  sharedWith?: { [uid: string]: string };
  isShared?: boolean;
}
