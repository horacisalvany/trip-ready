import { Section } from '../list/section';

export interface List {
  id: string;
  title: string;
  sections: Section[];
  ownerUid?: string;
  ownerEmail?: string;
  sharedWith?: { [uid: string]: string };
  isShared?: boolean;
}
