import { Item } from './item';

export interface Section {
  id: string;
  title: string;
  items: Item[];
  sourceGroupId?: string;
}
